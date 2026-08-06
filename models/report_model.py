from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class Report(Base):
    """Persisted combined report (plagiarism + AI detection) for a single submission."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    # Full combined report stored as JSONB for efficient querying
    report_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Report id={self.id} file={self.filename!r} user={self.user_id!r}>"
