"""
report_service.py
─────────────────
Orchestrates the full analysis pipeline for a single uploaded file:

  1. Extract text  (file_extractor)
  2. Plagiarism check — internal repo + web  (plagiarism_engine + web_search_matcher)
  3. AI-generation detection                 (ai_detector)
  4. Combine all results into CombinedReport
  5. Persist the report to the `reports` table
  6. Return the report to the caller

Steps 2 and 3 run concurrently via asyncio.gather() for speed.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.report_model import Report
from models.schemas import (
    AIDetectionResult,
    AIFlaggedSegment,
    CombinedReport,
    MatchedSource,
    PlagiarismReport,
    ReportSummary,
)
from services.ai_detector import detect_ai_text, is_loaded
from services.file_extractor import extract_text
from services.plagiarism_engine import run_plagiarism_check
from utils.file_utils import count_words

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_matched_sources(plagiarism: PlagiarismReport) -> list[MatchedSource]:
    """Convert internal MatchedChunk and WebMatchedChunk lists into MatchedSource."""
    sources: list[MatchedSource] = []

    for m in plagiarism.matched_chunks:
        sources.append(
            MatchedSource(
                text=m.chunk,
                source=f"internal:doc_{m.matched_doc_id}",
                similarity=round(m.score * 100, 2),
                type="internal",
            )
        )

    for w in plagiarism.web_matches:
        sources.append(
            MatchedSource(
                text=w.chunk,
                source=w.source_url,
                similarity=round(w.score * 100, 2),
                type="web",
            )
        )

    # Sort by descending similarity
    sources.sort(key=lambda s: s.similarity, reverse=True)
    return sources


def _build_ai_flagged_segments(
    ai_result: AIDetectionResult,
    full_text: str,
) -> list[AIFlaggedSegment]:
    """
    Extract AI-flagged segments.
    - Multi-chunk docs: use per-chunk results where ai_probability >= 50.
    - Single-chunk docs: flag the whole doc if overall ai_probability >= 50.
    """
    segments: list[AIFlaggedSegment] = []

    if ai_result.chunk_results:  # multi-chunk
        for chunk in ai_result.chunk_results:
            if chunk.ai_probability >= 50.0:
                segments.append(
                    AIFlaggedSegment(
                        text=chunk.text_preview[:200],
                        confidence=chunk.ai_probability,
                    )
                )
    else:  # single chunk — use overall probability
        if ai_result.ai_probability >= 50.0:
            segments.append(
                AIFlaggedSegment(
                    text=full_text[:200],
                    confidence=ai_result.ai_probability,
                )
            )

    segments.sort(key=lambda s: s.confidence, reverse=True)
    return segments


def _to_report_summary(report: Report) -> ReportSummary:
    """Construct a lightweight ReportSummary from an ORM Report instance."""
    rj = report.report_json
    return ReportSummary(
        report_id=report.id,
        filename=report.filename,
        plagiarism_percentage=rj.get("plagiarism_percentage", 0.0),
        ai_generated_percentage=rj.get("ai_generated_percentage", 0.0),
        ai_label=rj.get("ai_label", "unknown"),
        created_at=rj.get("created_at", report.created_at.isoformat()),
        user_id=report.user_id,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────────────────────

async def generate_combined_report(
    file: UploadFile,
    user_id: Optional[str],
    enable_web_search: bool,
    db: AsyncSession,
) -> CombinedReport:
    """
    Full pipeline: parse → (plagiarism ∥ AI detect) → combine → persist → return.
    """
    # ── 1. Extract text from the uploaded file ────────────────────────────
    filename = file.filename or "unknown"
    text = await extract_text(file)
    word_count = count_words(text)
    logger.info("Extracted %d words from '%s'", word_count, filename)

    # ── 2. Run plagiarism check and AI detection concurrently ─────────────
    #   Plagiarism engine is async (uses the DB session).
    #   AI detection is CPU-bound; wrap in to_thread so it runs in parallel.
    plagiarism_coro = run_plagiarism_check(
        text=text,
        user_id=user_id,
        db=db,
        enable_web_search=enable_web_search,
    )

    if is_loaded():
        ai_coro = asyncio.to_thread(detect_ai_text, text)
        plagiarism_report, ai_result = await asyncio.gather(plagiarism_coro, ai_coro)
    else:
        # Model not yet loaded — run plagiarism only, return empty AI result
        logger.warning("AI detector not loaded — skipping AI detection for this report.")
        plagiarism_report = await plagiarism_coro
        ai_result = AIDetectionResult(
            label="unknown",
            confidence=0.0,
            ai_probability=0.0,
            total_chunks=0,
            chunk_results=[],
            model_used="not_loaded",
        )

    # ── 3. Combine results ────────────────────────────────────────────────
    matched_sources = _build_matched_sources(plagiarism_report)
    ai_flagged = _build_ai_flagged_segments(ai_result, text)
    created_at = datetime.now(timezone.utc).isoformat()

    report_data = CombinedReport(
        report_id=0,           # placeholder; overwritten after DB insert
        filename=filename,
        full_text=text,
        plagiarism_percentage=plagiarism_report.overall_percentage,
        ai_generated_percentage=ai_result.ai_probability,
        matched_sources=matched_sources,
        ai_flagged_segments=ai_flagged,
        created_at=created_at,
        user_id=user_id,
        word_count=word_count,
        total_chunks=plagiarism_report.total_chunks,
        internal_percentage=plagiarism_report.internal_percentage,
        web_percentage=plagiarism_report.web_percentage,
        ai_label=ai_result.label,
        document_id=plagiarism_report.document_id,
    )

    # ── 4. Persist to `reports` table ─────────────────────────────────────
    report_row = Report(
        user_id=user_id,
        filename=filename,
        report_json=report_data.model_dump(),
    )
    db.add(report_row)
    await db.flush()
    await db.refresh(report_row)

    # Patch the real DB id back in
    report_data.report_id = report_row.id

    # Persist the final report_json with the real id
    report_row.report_json = report_data.model_dump()
    await db.commit()

    logger.info(
        "Report id=%d saved: plagiarism=%.1f%% ai=%.1f%% (%s)",
        report_row.id,
        report_data.plagiarism_percentage,
        report_data.ai_generated_percentage,
        report_data.ai_label,
    )
    return report_data


# ─────────────────────────────────────────────────────────────────────────────
# DB read helpers
# ─────────────────────────────────────────────────────────────────────────────

async def get_report_by_id(report_id: int, db: AsyncSession) -> CombinedReport | None:
    """Fetch a single report by primary key. Returns None if not found."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    row: Report | None = result.scalar_one_or_none()
    if row is None:
        return None
    return CombinedReport(**row.report_json)


async def list_reports_for_user(user_id: str, db: AsyncSession) -> list[ReportSummary]:
    """Return summary rows for every report belonging to a given user_id."""
    result = await db.execute(
        select(Report)
        .where(Report.user_id == user_id)
        .order_by(Report.created_at.desc())
    )
    rows = result.scalars().all()
    return [_to_report_summary(r) for r in rows]
