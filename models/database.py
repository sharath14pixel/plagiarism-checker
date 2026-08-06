import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:password@localhost:5432/plagiarism_db",
)

# ── Engine ────────────────────────────────────────────────────────────────
engine = create_async_engine(
    DATABASE_URL,
    echo=False,          # set True to log SQL queries during development
    pool_pre_ping=True,  # verify connections before handing them out
    pool_size=10,
    max_overflow=20,
)

# ── Session factory ───────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Declarative base ──────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependency ────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# ── DDL helper (called at app startup) ───────────────────────────────────
async def init_db() -> None:
    """Create all tables that are registered on Base.metadata."""
    # Import all models here so metadata is populated before create_all.
    from models import document_model, report_model, user_model  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
