import io
from fastapi import HTTPException, UploadFile

# pyrefly: ignore [missing-import]
import pdfplumber
from docx import Document


async def extract_text(file: UploadFile) -> str:
    """
    Dispatch to the correct extractor based on file extension.
    Raises HTTPException on unsupported types or extraction failures.
    """
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    content = await file.read()

    if ext == "pdf":
        return _extract_from_pdf(content, filename)
    elif ext == "docx":
        return _extract_from_docx(content, filename)
    elif ext == "txt":
        return _extract_from_txt(content, filename)
    else:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '.{ext}'. Allowed: pdf, docx, txt.",
        )


def _extract_from_pdf(content: bytes, filename: str) -> str:
    """Extract plain text from a PDF using pdfplumber."""
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            pages_text = [page.extract_text() or "" for page in pdf.pages]
        text = "\n".join(pages_text).strip()
        if not text:
            raise HTTPException(
                status_code=422,
                detail=f"'{filename}' appears to be a scanned/image-only PDF with no extractable text.",
            )
        return text
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to read PDF '{filename}': {str(exc)}",
        ) from exc


def _extract_from_docx(content: bytes, filename: str) -> str:
    """Extract plain text from a DOCX file using python-docx."""
    try:
        doc = Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs]
        text = "\n".join(paragraphs).strip()
        if not text:
            raise HTTPException(
                status_code=422,
                detail=f"'{filename}' is empty or contains no readable text.",
            )
        return text
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to read DOCX '{filename}': {str(exc)}",
        ) from exc


def _extract_from_txt(content: bytes, filename: str) -> str:
    """Decode a plain-text file, trying UTF-8 then latin-1 as fallback."""
    try:
        text = content.decode("utf-8").strip()
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1").strip()
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Failed to decode TXT file '{filename}': {str(exc)}",
            ) from exc

    if not text:
        raise HTTPException(
            status_code=422,
            detail=f"'{filename}' is an empty file.",
        )
    return text
