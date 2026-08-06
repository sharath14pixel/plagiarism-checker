"""
plagiarism_engine.py
────────────────────
Core plagiarism-detection logic:

Pipeline
────────
1.  Sentence-tokenise the submitted text with NLTK.
2.  Pre-process each chunk (lower-case → strip punctuation → remove stopwords).
3.  Save the raw document to PostgreSQL (documents table).
4.  Fetch every previously stored document from the DB.
5.  Tokenise + pre-process stored documents in the same way.
6.  Fit a single TfidfVectorizer over *all* chunks (input + stored).
7.  Compute cosine_similarity between input vectors and stored vectors.
8.  For each input chunk find the best-matching stored chunk  (internal repo).
9.  Optionally run web-based matching via web_search_matcher (asyncio.to_thread).
10. Merge internal + web results and return a combined PlagiarismReport.
"""

from __future__ import annotations

import asyncio
import re
import string
import logging
from typing import Optional

import nltk
import numpy as np
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.schemas import MatchedChunk, PlagiarismReport, WebMatchedChunk

logger = logging.getLogger(__name__)

# ── Minimum cosine similarity to treat a chunk as plagiarised ─────────────
SIMILARITY_THRESHOLD: float = 0.30

# ── Minimum number of tokens required for a chunk to be analysed ──────────
MIN_TOKENS: int = 3


# ─────────────────────────────────────────────────────────────────────────────
# NLTK bootstrap  (idempotent, safe to call multiple times)
# ─────────────────────────────────────────────────────────────────────────────

def setup_nltk() -> None:
    """Download required NLTK corpora if not already present."""
    for resource, path in [
        ("tokenizers/punkt_tab", "punkt_tab"),
        ("corpora/stopwords", "stopwords"),
    ]:
        try:
            nltk.data.find(resource)
        except LookupError:
            nltk.download(path, quiet=True)


# ─────────────────────────────────────────────────────────────────────────────
# Text utilities
# ─────────────────────────────────────────────────────────────────────────────

_STOP_WORDS: set[str] | None = None


def _get_stopwords() -> set[str]:
    global _STOP_WORDS
    if _STOP_WORDS is None:
        _STOP_WORDS = set(stopwords.words("english"))
    return _STOP_WORDS


def tokenize_text(text: str) -> list[str]:
    """Split text into sentences using NLTK's Punkt tokeniser."""
    return sent_tokenize(text.strip())


def preprocess(sentence: str) -> str:
    """
    Normalise a sentence for TF-IDF comparison:
      1. Lower-case
      2. Remove punctuation
      3. Remove stop-words
      4. Collapse whitespace
    Returns an empty string if nothing meaningful remains.
    """
    text = sentence.lower()
    text = re.sub(f"[{re.escape(string.punctuation)}]", " ", text)
    tokens = text.split()
    stop = _get_stopwords()
    tokens = [t for t in tokens if t not in stop and t.isalpha()]
    return " ".join(tokens)


# ─────────────────────────────────────────────────────────────────────────────
# Database helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _save_document(text: str, user_id: Optional[str], db: AsyncIOMotorDatabase) -> str:
    """Persist the submitted document and return its string ID."""
    doc = {"text": text, "user_id": user_id}
    result = await db.documents.insert_one(doc)
    return str(result.inserted_id)


async def _fetch_other_documents(exclude_id: str, db: AsyncIOMotorDatabase) -> list[dict]:
    """Return all documents stored *before* this submission."""
    cursor = db.documents.find({"_id": {"$ne": ObjectId(exclude_id)}})
    return await cursor.to_list(length=None)


# ─────────────────────────────────────────────────────────────────────────────
# Shared utilities
# ─────────────────────────────────────────────────────────────────────────────

def _calc_pct(matched: int, total: int) -> float:
    """Return a rounded percentage, safe against division by zero."""
    return round((matched / total) * 100, 2) if total > 0 else 0.0


async def _run_web_check(
    valid_input: list[tuple[str, str]],
    enabled: bool,
) -> list[WebMatchedChunk]:
    """
    Dispatch web matching in a thread pool so it doesn't block the event loop.
    Returns an empty list immediately when web search is disabled.
    """
    if not enabled:
        return []
    # Import here to avoid a circular import at module load time
    from services.web_search_matcher import perform_web_matching

    raw_sentences = [orig for (orig, _) in valid_input]
    return await asyncio.to_thread(perform_web_matching, raw_sentences)


# ─────────────────────────────────────────────────────────────────────────────
# Core engine
# ─────────────────────────────────────────────────────────────────────────────

async def run_plagiarism_check(
    text: str,
    user_id: Optional[str],
    db: AsyncIOMotorDatabase,
    enable_web_search: bool = True,
) -> PlagiarismReport:
    """
    Main entry point.  Saves the document, compares against the repository,
    and returns a structured PlagiarismReport.
    """
    # ── 1. Tokenise input ─────────────────────────────────────────────────
    raw_sentences: list[str] = tokenize_text(text)

    # Keep (original, preprocessed) pairs — filter out near-empty chunks
    valid_input: list[tuple[str, str]] = []
    for sent in raw_sentences:
        preprocessed = preprocess(sent)
        if len(preprocessed.split()) >= MIN_TOKENS:
            valid_input.append((sent, preprocessed))

    # ── 2. Persist the document ───────────────────────────────────────────
    doc_id = await _save_document(text, user_id, db)
    logger.info("Saved document id=%s (%d words)", doc_id, len(text.split()))

    # ── 3. Edge case: no valid input chunks ──────────────────────────────
    if not valid_input:
        return PlagiarismReport(
            document_id=doc_id,
            internal_percentage=0.0,
            web_percentage=0.0,
            overall_percentage=0.0,
            total_chunks=0,
            matched_chunks=[],
            web_matches=[],
        )

    # ── 4. Fetch all previously stored documents ─────────────────────────
    stored_docs = await _fetch_other_documents(exclude_id=doc_id, db=db)

    # ── 5. Edge case: empty repository — still run web check ────────────
    if not stored_docs:
        logger.info("Repository is empty – running web check only for doc id=%s", doc_id)
        web_matches = await _run_web_check(valid_input, enable_web_search)
        web_pct = _calc_pct(len(web_matches), len(valid_input))
        return PlagiarismReport(
            document_id=doc_id,
            internal_percentage=0.0,
            web_percentage=web_pct,
            overall_percentage=web_pct,
            total_chunks=len(valid_input),
            matched_chunks=[],
            web_matches=web_matches,
        )

    # ── 6. Build stored-chunk corpus ─────────────────────────────────────
    # Each entry: (preprocessed_text, stored_doc_id, original_sentence)
    StoredChunkEntry = tuple[str, str, str]
    stored_chunks: list[StoredChunkEntry] = []

    for stored_doc in stored_docs:
        for sent in tokenize_text(stored_doc["text"]):
            preprocessed = preprocess(sent)
            if len(preprocessed.split()) >= MIN_TOKENS:
                stored_chunks.append((preprocessed, str(stored_doc["_id"]), sent))

    if not stored_chunks:
        web_matches = await _run_web_check(valid_input, enable_web_search)
        web_pct = _calc_pct(len(web_matches), len(valid_input))
        return PlagiarismReport(
            document_id=doc_id,
            internal_percentage=0.0,
            web_percentage=web_pct,
            overall_percentage=web_pct,
            total_chunks=len(valid_input),
            matched_chunks=[],
            web_matches=web_matches,
        )

    # ── 7. TF-IDF vectorisation (fit on *all* text for shared vocabulary) ─
    input_preprocessed  = [p for (_, p) in valid_input]
    stored_preprocessed = [c[0] for c in stored_chunks]
    all_texts = input_preprocessed + stored_preprocessed

    vectorizer = TfidfVectorizer(
        sublinear_tf=True,      # apply log normalisation to term frequencies
        ngram_range=(1, 2),     # unigrams + bigrams for richer matching
        min_df=1,
    )
    tfidf_matrix = vectorizer.fit_transform(all_texts)

    n_input = len(input_preprocessed)
    input_vectors  = tfidf_matrix[:n_input]
    stored_vectors = tfidf_matrix[n_input:]

    # ── 8. Cosine similarity  (shape: n_input × n_stored) ────────────────
    sim_matrix: np.ndarray = cosine_similarity(input_vectors, stored_vectors)

    # ── 9. Build match list ───────────────────────────────────────────────
    matched_chunks: list[MatchedChunk] = []

    for i, (original_sent, _) in enumerate(valid_input):
        row = sim_matrix[i]                   # similarities against all stored chunks
        best_idx: int = int(np.argmax(row))
        best_score: float = float(row[best_idx])

        if best_score >= SIMILARITY_THRESHOLD:
            stored_preprocessed_text, stored_doc_id, stored_original = stored_chunks[best_idx]
            matched_chunks.append(
                MatchedChunk(
                    chunk=original_sent,
                    score=round(best_score, 4),
                    matched_doc_id=stored_doc_id,
                    matched_chunk=stored_original,
                )
            )

    # ── 10. Web-based matching ────────────────────────────────────────────
    all_input_sentences = [orig for (orig, _) in valid_input]
    web_matches = await _run_web_check(valid_input, enable_web_search)

    # ── 11. Percentages ───────────────────────────────────────────────────
    total = len(valid_input)
    internal_pct = _calc_pct(len(matched_chunks), total)
    web_pct      = _calc_pct(len(web_matches), total)

    # Overall = fraction of chunks flagged by EITHER source (deduplicated by text)
    internally_matched_texts = {m.chunk for m in matched_chunks}
    web_matched_texts         = {m.chunk for m in web_matches}
    combined_count = len(internally_matched_texts | web_matched_texts)
    overall_pct = _calc_pct(combined_count, total)

    # Sort by descending similarity so the worst offences appear first
    matched_chunks.sort(key=lambda m: m.score, reverse=True)

    logger.info(
        "Doc id=%s: internal=%d/%d (%.1f%%) | web=%d/%d (%.1f%%) | overall=%.1f%%",
        doc_id,
        len(matched_chunks), total, internal_pct,
        len(web_matches),    total, web_pct,
        overall_pct,
    )

    return PlagiarismReport(
        document_id=doc_id,
        internal_percentage=internal_pct,
        web_percentage=web_pct,
        overall_percentage=overall_pct,
        total_chunks=total,
        matched_chunks=matched_chunks,
        web_matches=web_matches,
    )
