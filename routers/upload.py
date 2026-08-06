from fastapi import APIRouter, File, UploadFile, HTTPException

from models.schemas import UploadResponse
from services.file_extractor import extract_text
from utils.file_utils import is_allowed_file, count_words

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post(
    "",
    response_model=UploadResponse,
    summary="Upload a document and extract its text",
    description=(
        "Accepts a PDF, DOCX, or TXT file and returns the extracted plain text "
        "along with the filename and word count."
    ),
)
async def upload_file(file: UploadFile = File(...)):
    # ── 1. Validate file presence ──────────────────────────────────────────
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file was provided.")

    # ── 2. Validate extension before doing any heavy I/O ──────────────────
    if not is_allowed_file(file.filename):
        ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "unknown"
        raise HTTPException(
            status_code=415,
            detail=f"File type '.{ext}' is not supported. Allowed types: pdf, docx, txt.",
        )

    # ── 3. Delegate extraction to the service layer ────────────────────────
    text = await extract_text(file)

    # ── 4. Build and return the response ──────────────────────────────────
    return UploadResponse(
        text=text,
        filename=file.filename,
        word_count=count_words(text),
    )
