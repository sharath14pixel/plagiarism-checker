from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.database import get_db
from models.schemas import PlagiarismCheckRequest, PlagiarismReport
from services.plagiarism_engine import run_plagiarism_check

from utils.auth import get_current_user

router = APIRouter(prefix="/check-plagiarism", tags=["Plagiarism"])


@router.post(
    "",
    response_model=PlagiarismReport,
    summary="Analyse text for plagiarism against the internal repository and the public web",
    description=(
        "Accepts extracted plain text, saves it to the document repository, "
        "then runs two checks in parallel:\n"
        "1. **Internal repo**: TF-IDF cosine similarity against all previously stored documents.\n"
        "2. **Web search** (optional): Google Custom Search + page scraping + TF-IDF comparison.\n"
        "Returns a combined report with internal_percentage, web_percentage, overall_percentage, "
        "and full match lists for both sources."
    ),
)
async def check_plagiarism(
    payload: PlagiarismCheckRequest,
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> PlagiarismReport:
    try:
        report = await run_plagiarism_check(
            text=payload.text,
            user_id=current_user_id,
            db=db,
            enable_web_search=payload.enable_web_search,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Plagiarism check failed: {str(exc)}",
        ) from exc

    return report
