from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class Document(Base):
    """Persisted document used as the internal repository for comparison."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    # Optional: tie a document to a specific user/session
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    def __repr__(self) -> str:
        return f"<Document id={self.id} user_id={self.user_id!r} words={len(self.text.split())}>"
