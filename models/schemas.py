from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# /upload response
# ─────────────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    """Response schema for the POST /upload endpoint."""
    text: str
    filename: str
    word_count: int


# ─────────────────────────────────────────────────────────────────────────────
# /check-plagiarism  request & response
# ─────────────────────────────────────────────────────────────────────────────

class PlagiarismCheckRequest(BaseModel):
    """Payload for the POST /check-plagiarism endpoint."""
    text: str = Field(..., min_length=20, description="Extracted text to analyse.")
    user_id: Optional[str] = Field(None, description="Optional user/session identifier.")
    enable_web_search: bool = Field(
        True,
        description="Whether to run web-based plagiarism matching in addition to internal repo check.",
    )


# ── Internal repository match ─────────────────────────────────────────────────

class MatchedChunk(BaseModel):
    """A sentence from the input that matched a previously stored internal document."""
    chunk: str = Field(..., description="Original sentence from the submitted text.")
    score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity score (0–1).")
    matched_doc_id: int = Field(..., description="ID of the stored document that matched.")
    matched_chunk: str = Field(..., description="The matching sentence from the stored document.")


# ── Web match ─────────────────────────────────────────────────────────────────

class WebMatchedChunk(BaseModel):
    """A sentence from the input that matched content found on the public web."""
    chunk: str = Field(..., description="Original sentence from the submitted text.")
    score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity score (0–1).")
    source_url: str = Field(..., description="URL of the web page that matched.")
    matched_text_preview: str = Field(
        ..., description="Short preview of the best-matching sentence from the web page."
    )


# ── Combined report ───────────────────────────────────────────────────────────

class PlagiarismReport(BaseModel):
    """Full similarity report combining internal-repository and web-based matches."""

    document_id: int = Field(..., description="DB id of the newly stored document.")

    # Granular percentages
    internal_percentage: float = Field(
        ..., ge=0.0, le=100.0,
        description="Percentage of chunks matched against the internal document repository.",
    )
    web_percentage: float = Field(
        ..., ge=0.0, le=100.0,
        description="Percentage of chunks matched against public web sources.",
    )
    overall_percentage: float = Field(
        ..., ge=0.0, le=100.0,
        description="Combined plagiarism percentage (union of internal + web matches).",
    )

    total_chunks: int = Field(..., description="Number of sentences/chunks analysed.")

    # Match lists
    matched_chunks: list[MatchedChunk] = Field(
        default_factory=list,
        description="Internal-repository matches sorted by descending similarity.",
    )
    web_matches: list[WebMatchedChunk] = Field(
        default_factory=list,
        description="Web-based matches sorted by descending similarity.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# /check-ai  request & response
# ─────────────────────────────────────────────────────────────────────────────

class AIDetectionRequest(BaseModel):
    """Payload for the POST /check-ai endpoint."""
    text: str = Field(..., min_length=20, description="Extracted text to analyse for AI authorship.")


class ChunkAnalysis(BaseModel):
    """Per-chunk inference result for long documents."""
    chunk_index: int = Field(..., description="Zero-based chunk number.")
    text_preview: str = Field(..., description="First 120 characters of the chunk.")
    label: str = Field(..., description="Predicted label for this chunk ('human' or 'ai-generated').")
    confidence: float = Field(..., ge=0.0, le=100.0, description="Confidence in the predicted label (%).")
    ai_probability: float = Field(..., ge=0.0, le=100.0, description="Raw AI-probability score for this chunk (%).")


class AIDetectionResult(BaseModel):
    """Overall AI-detection result for a submitted document."""
    label: str = Field(..., description="Document-level label ('human' or 'ai-generated').")
    confidence: float = Field(..., ge=0.0, le=100.0, description="Confidence in the document-level label (%).")
    ai_probability: float = Field(
        ..., ge=0.0, le=100.0,
        description="Average AI-probability across all chunks (%). ≥50 → ai-generated.",
    )
    total_chunks: int = Field(..., description="Number of 500-token chunks analysed.")
    chunk_results: list[ChunkAnalysis] = Field(
        default_factory=list,
        description="Per-chunk breakdown (omitted when only one chunk).",
    )
    model_used: str = Field(..., description="Hugging Face model identifier used for detection.")


# ─────────────────────────────────────────────────────────────────────────────
# /generate-report  request & response
# ─────────────────────────────────────────────────────────────────────────────

class MatchedSource(BaseModel):
    """One plagiarism match — either from the internal repository or the web."""
    text: str = Field(..., description="The matched sentence/chunk from the submitted document.")
    source: str = Field(
        ...,
        description=(
            "For internal matches: 'internal:doc_{id}'. "
            "For web matches: the source URL."
        ),
    )
    similarity: float = Field(..., ge=0.0, le=100.0, description="Similarity score as a percentage (0–100).")
    type: str = Field(..., description="Match origin: 'internal' or 'web'.")


class AIFlaggedSegment(BaseModel):
    """A text segment that the AI detector classified as AI-generated."""
    text: str = Field(..., description="Preview of the AI-flagged segment (up to 200 chars).")
    confidence: float = Field(..., ge=0.0, le=100.0, description="AI-generation confidence (%).")


class CombinedReport(BaseModel):
    """
    Full combined report merging file parsing, plagiarism detection,
    web matching, and AI-generation analysis.
    """
    # Core fields (as specified)
    report_id: int = Field(..., description="DB id of the saved report.")
    filename: str = Field(..., description="Name of the uploaded file.")
    full_text: str = Field(..., description="The complete text of the submitted document.")
    plagiarism_percentage: float = Field(..., ge=0.0, le=100.0, description="Overall plagiarism % (internal + web union).")
    ai_generated_percentage: float = Field(..., ge=0.0, le=100.0, description="Overall AI-generation probability %.")
    matched_sources: list[MatchedSource] = Field(default_factory=list, description="All plagiarism matches.")
    ai_flagged_segments: list[AIFlaggedSegment] = Field(default_factory=list, description="Segments flagged as AI-generated.")
    created_at: str = Field(..., description="ISO-8601 timestamp of report creation.")

    # Extra metadata
    user_id: Optional[str] = Field(None, description="User/session id if provided.")
    word_count: int = Field(..., description="Word count of the uploaded document.")
    total_chunks: int = Field(..., description="Number of sentence chunks analysed.")
    internal_percentage: float = Field(..., ge=0.0, le=100.0, description="Plagiarism % from internal repository only.")
    web_percentage: float = Field(..., ge=0.0, le=100.0, description="Plagiarism % from web sources only.")
    ai_label: str = Field(..., description="Document-level AI label ('human' or 'ai-generated').")
    document_id: int = Field(..., description="DB id of the stored document (plagiarism repository).")


class ReportSummary(BaseModel):
    """Lightweight report listing item — used by GET /reports/user/{user_id}."""
    report_id: int
    filename: str
    plagiarism_percentage: float
    ai_generated_percentage: float
    ai_label: str
    created_at: str
    user_id: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# /auth  request & response
# ─────────────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str = Field(..., description="User's email address")
    password: str = Field(..., min_length=6, description="User's password")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: str


