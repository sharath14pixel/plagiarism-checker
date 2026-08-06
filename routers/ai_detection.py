import asyncio

from fastapi import APIRouter, HTTPException

from models.schemas import AIDetectionRequest, AIDetectionResult
from services.ai_detector import detect_ai_text, is_loaded

router = APIRouter(prefix="/check-ai", tags=["AI Detection"])


@router.post(
    "",
    response_model=AIDetectionResult,
    summary="Detect whether submitted text was written by an AI",
    description=(
        "Runs the **desklib/ai-text-detector-v1.01** transformer model on the submitted text. "
        "For long inputs, the text is split into ≤500-token chunks; inference is run on each "
        "chunk and the AI-probability scores are averaged to produce a document-level verdict. "
        "Returns a label ('human' or 'ai-generated'), an overall confidence %, and a "
        "per-chunk breakdown for multi-chunk documents."
    ),
)
async def check_ai(payload: AIDetectionRequest) -> AIDetectionResult:
    if not is_loaded():
        raise HTTPException(
            status_code=503,
            detail=(
                "AI detection model is not available. "
                "The model may still be loading — please retry in a moment."
            ),
        )

    try:
        # Run the CPU-bound inference in a thread pool so the event loop stays free
        result: AIDetectionResult = await asyncio.to_thread(detect_ai_text, payload.text)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI detection failed: {str(exc)}",
        ) from exc

    return result
