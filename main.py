from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from models.database import init_db, close_db
from routers import upload, plagiarism, ai_detection, report, auth
from services.plagiarism_engine import setup_nltk
from services.ai_detector import load_ai_detector


# ── Lifespan: runs once on startup / shutdown ─────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_nltk()          # download punkt_tab + stopwords if missing
    await init_db()       # CREATE TABLE IF NOT EXISTS for all ORM models
    
    # Load AI detector model in background so server starts responding immediately
    import asyncio
    asyncio.create_task(asyncio.to_thread(load_ai_detector))
    yield
    await close_db()
    # Shutdown (nothing to clean up yet)


# ── App instance ───────────────────────────────────────────────────────────
app = FastAPI(
    title="Plagiarism Checker API",
    description="Backend API for extracting and analysing text from uploaded documents.",
    version="5.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS – allow the Next.js frontend on localhost:3000 ───────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(plagiarism.router)
app.include_router(ai_detection.router)
app.include_router(report.router)


# ── Health check ──────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Plagiarism Checker API is running.", "version": "4.0.0"}
