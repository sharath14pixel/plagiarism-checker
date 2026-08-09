from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
# pyrefly: ignore [missing-import]
from motor.motor_asyncio import AsyncIOMotorDatabase  # type: ignore

from models.database import get_db
from models.schemas import CombinedReport, ReportSummary
from services.report_service import (
    generate_combined_report,
    get_report_by_id,
    list_reports_for_user,
)
from utils.auth import get_current_user
from utils.file_utils import is_allowed_file

router = APIRouter(prefix="/reports", tags=["Reports"])


# ─────────────────────────────────────────────────────────────────────────────
# POST /reports/generate  →  full pipeline
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=CombinedReport,
    summary="Upload a file and generate a full combined report",
    description=(
        "Accepts a PDF, DOCX, or TXT file and runs the complete analysis pipeline:\n"
        "1. **Text extraction** (pdfplumber / python-docx / plain text)\n"
        "2. **Internal plagiarism check** — TF-IDF cosine similarity vs stored documents\n"
        "3. **Web plagiarism check** — Google Custom Search + page scraping (optional)\n"
        "4. **AI-generation detection** — desklib/ai-text-detector-v1.01 transformer\n\n"
        "The combined report is saved to MongoDB and returned as JSON."
    ),
)
async def generate_report(
    file: UploadFile = File(..., description="PDF, DOCX, or TXT file to analyse."),
    enable_web_search: bool = Form(True, description="Enable web-based plagiarism matching."),
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> CombinedReport:
    # ── Validate extension before doing any work ──────────────────────────
    if not file.filename or not is_allowed_file(file.filename):
        ext = (
            file.filename.rsplit(".", 1)[-1]
            if file.filename and "." in file.filename
            else "unknown"
        )
        raise HTTPException(
            status_code=415,
            detail=f"File type '.{ext}' is not supported. Allowed: pdf, docx, txt.",
        )

    try:
        report = await generate_combined_report(
            file=file,
            user_id=current_user_id,
            enable_web_search=enable_web_search,
            db=db,
        )
    except HTTPException:
        raise  # re-raise extraction errors (corrupted file, etc.)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Report generation failed: {str(exc)}",
        ) from exc

    return report


# ─────────────────────────────────────────────────────────────────────────────
# GET /reports/{id}  →  fetch one report
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{report_id}",
    response_model=CombinedReport,
    summary="Fetch a saved report by ID",
)
async def get_report(
    report_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> CombinedReport:
    report = await get_report_by_id(report_id, db)
    if report is None:
        raise HTTPException(status_code=404, detail=f"Report id={report_id} not found.")
    if report.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this report.")
    return report


# ─────────────────────────────────────────────────────────────────────────────
# GET /reports/user/{user_id}  →  list all reports for a user
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/user/{user_id}",
    response_model=list[ReportSummary],
    summary="List all past reports for a user",
    description="Returns lightweight summary rows sorted by creation date (newest first).",
)
async def list_user_reports(
    user_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ReportSummary]:
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view these reports.")
    return await list_reports_for_user(user_id, db)
