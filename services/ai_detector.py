"""
ai_detector.py
──────────────
AI-generated text detection using Hugging Face transformers.

Model
─────
  desklib/ai-text-detector-v1.01
  (AutoTokenizer + AutoModelForSequenceClassification)

Pipeline
─────────
1.  Model + tokenizer loaded ONCE at app startup (load_ai_detector).
2.  For long texts: tokenize → split into 500-token chunks → decode back to str.
3.  Run inference on each chunk (max 512 tokens, CPU or CUDA).
4.  Softmax → extract AI-probability per chunk.
5.  Average AI-probability across all chunks → document-level score.
6.  Threshold ≥ 50 % → "ai-generated", else "human".
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from models.schemas import AIDetectionResult, ChunkAnalysis

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
MODEL_NAME = "desklib/ai-text-detector-v1.01"
CHUNK_SIZE_TOKENS = 500   # tokens per inference chunk (leave room for specials)
MAX_MODEL_INPUT = 512     # hard limit of the model
AI_THRESHOLD = 50.0       # AI-probability % above which we label "ai-generated"

# ── Module-level singletons (populated by load_ai_detector) ──────────────────
_tokenizer: Optional[AutoTokenizer] = None
_model: Optional[AutoModelForSequenceClassification] = None
_device: Optional[torch.device] = None
_ai_label_idx: int = 1    # default: index 1 → "AI"; overridden from model config


# ─────────────────────────────────────────────────────────────────────────────
# Startup loader  (call once from FastAPI lifespan)
# ─────────────────────────────────────────────────────────────────────────────

def load_ai_detector() -> None:
    """
    Download (first run) and load the model + tokenizer into module globals.
    Safe to call multiple times — skips if already loaded.
    """
    global _tokenizer, _model, _device, _ai_label_idx

    if _model is not None:
        logger.debug("AI detector already loaded — skipping.")
        return

    logger.info("Loading AI detector model '%s' …", MODEL_NAME)

    # ── Device selection ──────────────────────────────────────────────────
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Running on device: %s", _device)

    # ── Load tokenizer & model ────────────────────────────────────────────
    _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    _model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    _model.to(_device)
    _model.eval()  # disable dropout etc. for inference

    # ── Discover the AI label index from model config ─────────────────────
    id2label: dict = getattr(_model.config, "id2label", {})
    for idx, label_str in id2label.items():
        if "ai" in str(label_str).lower() or "fake" in str(label_str).lower():
            _ai_label_idx = int(idx)
            break
    logger.info(
        "Model loaded. id2label=%s  →  AI label index=%d",
        id2label, _ai_label_idx,
    )


def is_loaded() -> bool:
    return _model is not None


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _split_into_chunks(text: str) -> list[str]:
    """
    Tokenize the full text (no special tokens), split into CHUNK_SIZE_TOKENS
    pieces, and decode each piece back to a human-readable string.

    This preserves word boundaries better than naïve character splitting and
    ensures every chunk fits within the model's MAX_MODEL_INPUT limit.
    """
    assert _tokenizer is not None, "Tokenizer not loaded."

    token_ids: list[int] = _tokenizer.encode(
        text,
        add_special_tokens=False,
        truncation=False,
    )

    chunks: list[str] = []
    for start in range(0, len(token_ids), CHUNK_SIZE_TOKENS):
        piece_ids = token_ids[start : start + CHUNK_SIZE_TOKENS]
        chunk_text = _tokenizer.decode(piece_ids, skip_special_tokens=True)
        if chunk_text.strip():
            chunks.append(chunk_text)

    return chunks or [text]   # fallback: treat whole text as one chunk


def _infer_chunk(chunk_text: str) -> tuple[float, float]:
    """
    Run the model on a single chunk.

    Returns
    ───────
    (ai_probability_pct, human_probability_pct)
    """
    assert _tokenizer is not None and _model is not None and _device is not None

    inputs = _tokenizer(
        chunk_text,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_MODEL_INPUT,
        padding=True,
    )
    # Move all tensors to the right device
    inputs = {k: v.to(_device) for k, v in inputs.items()}

    with torch.no_grad():
        logits = _model(**inputs).logits          # shape: (1, num_labels)

    probs: np.ndarray = (
        torch.softmax(logits, dim=-1)[0].cpu().numpy()
    )

    ai_prob  = float(probs[_ai_label_idx]) * 100
    # human prob is everything that isn't the AI label
    human_prob = 100.0 - ai_prob
    return ai_prob, human_prob


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def detect_ai_text(text: str) -> AIDetectionResult:
    """
    Analyse text for AI authorship and return a structured AIDetectionResult.

    Steps
    ─────
    1. Ensure model is loaded.
    2. Split into ≤500-token chunks.
    3. Run inference on every chunk.
    4. Average AI-probability → document-level score.
    5. Build and return AIDetectionResult.
    """
    if not is_loaded():
        raise RuntimeError(
            "AI detector model is not loaded. "
            "Call load_ai_detector() at application startup."
        )

    chunks = _split_into_chunks(text)
    logger.info("AI detection: %d chunk(s) to analyse.", len(chunks))

    chunk_results: list[ChunkAnalysis] = []
    ai_probs: list[float] = []

    for idx, chunk in enumerate(chunks):
        ai_prob, human_prob = _infer_chunk(chunk)
        ai_probs.append(ai_prob)

        chunk_label = "ai-generated" if ai_prob >= AI_THRESHOLD else "human"
        chunk_confidence = ai_prob if chunk_label == "ai-generated" else human_prob

        chunk_results.append(
            ChunkAnalysis(
                chunk_index=idx,
                text_preview=chunk[:120],
                label=chunk_label,
                confidence=round(chunk_confidence, 2),
                ai_probability=round(ai_prob, 2),
            )
        )
        logger.debug(
            "  Chunk %d: ai_prob=%.1f%% → %s", idx, ai_prob, chunk_label
        )

    # ── Document-level aggregation ────────────────────────────────────────
    avg_ai_prob = float(np.mean(ai_probs))
    doc_label = "ai-generated" if avg_ai_prob >= AI_THRESHOLD else "human"
    doc_confidence = avg_ai_prob if doc_label == "ai-generated" else (100.0 - avg_ai_prob)

    logger.info(
        "AI detection result: avg_ai_prob=%.1f%% → %s (confidence=%.1f%%)",
        avg_ai_prob, doc_label, doc_confidence,
    )

    return AIDetectionResult(
        label=doc_label,
        confidence=round(doc_confidence, 2),
        ai_probability=round(avg_ai_prob, 2),
        total_chunks=len(chunks),
        # Only include per-chunk breakdown when there are multiple chunks
        chunk_results=chunk_results if len(chunks) > 1 else [],
        model_used=MODEL_NAME,
    )
