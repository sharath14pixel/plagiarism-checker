"""
web_search_matcher.py
─────────────────────
Web-based plagiarism matching pipeline:

Pipeline (per-chunk)
─────────────────────
1.  Filter for chunks that are long enough to make a meaningful search query.
2.  Build an exact-phrase Google Custom Search query from the first N words.
3.  Retrieve up to MAX_URLS_PER_QUERY result URLs from the Google API.
4.  For each URL, fetch the HTML with requests and extract clean visible text
    via BeautifulSoup (strips <nav>, <script>, <style>, <footer>, etc.).
5.  Run TF-IDF + cosine_similarity between the chunk and all page sentences.
6.  If the best match score ≥ WEB_SIMILARITY_THRESHOLD, mark the chunk
    as matched and store the source URL + a text preview.
7.  Move to the next chunk (one URL match per chunk is sufficient).

Resilience
───────────
- Any network error, HTTP error, or parse error is caught and logged; the
  pipeline simply skips that URL / chunk and continues.
- Google API 429 responses are detected and the query is skipped.
- A small inter-query delay avoids hammering rate limits.
- The entire function is synchronous (no async I/O) and is called from the
  async engine via asyncio.to_thread(), keeping the event-loop unblocked.
"""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Re-use tokenizer and preprocessor from the engine so behaviour is identical
from services.plagiarism_engine import MIN_TOKENS, preprocess, tokenize_text
from models.schemas import WebMatchedChunk

logger = logging.getLogger(__name__)

# ── Config (from environment) ─────────────────────────────────────────────────
GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_SEARCH_ENGINE_ID: str = os.getenv("GOOGLE_SEARCH_ENGINE_ID", "")
GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"

# ── Tuning constants ──────────────────────────────────────────────────────────
WEB_SIMILARITY_THRESHOLD: float = 0.60   # higher bar than internal (0.30)
MIN_CHUNK_WORDS: int = 8                 # skip very short chunks
MAX_QUERY_WORDS: int = 10               # Google exact-phrase query length cap
MAX_URLS_PER_QUERY: int = 3             # results to fetch per chunk
FETCH_TIMEOUT: int = 10                 # seconds for page fetch
INTER_QUERY_DELAY: float = 0.4          # seconds between Google API calls
MAX_PAGE_TEXT_CHARS: int = 60_000       # truncate very long pages before TF-IDF

# Tags whose content is always noise
_NOISE_TAGS = ["script", "style", "nav", "header", "footer",
               "aside", "noscript", "iframe", "form", "button", "svg"]

_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


# ─────────────────────────────────────────────────────────────────────────────
# Step helpers
# ─────────────────────────────────────────────────────────────────────────────

def _is_searchable(chunk: str) -> bool:
    """Only search chunks with enough words to produce a meaningful query."""
    return len(chunk.split()) >= MIN_CHUNK_WORDS


def _build_query(chunk: str) -> str:
    """Take the first MAX_QUERY_WORDS words and wrap them in exact-phrase quotes."""
    words = chunk.split()[:MAX_QUERY_WORDS]
    return f'"{" ".join(words)}"'


def _google_search(query: str) -> list[str]:
    """
    Call the Google Custom Search JSON API.
    Returns a list of result URLs (up to MAX_URLS_PER_QUERY).
    Returns [] on any error, including missing credentials or rate-limits.
    """
    if not GOOGLE_API_KEY or not GOOGLE_SEARCH_ENGINE_ID:
        logger.warning(
            "GOOGLE_API_KEY / GOOGLE_SEARCH_ENGINE_ID not set — web search disabled."
        )
        return []

    try:
        resp = requests.get(
            GOOGLE_SEARCH_URL,
            params={
                "key": GOOGLE_API_KEY,
                "cx": GOOGLE_SEARCH_ENGINE_ID,
                "q": query,
                "num": MAX_URLS_PER_QUERY,
            },
            timeout=FETCH_TIMEOUT,
        )

        if resp.status_code == 429:
            logger.warning("Google API rate-limit (429) — skipping query: %s", query)
            return []

        resp.raise_for_status()
        items = resp.json().get("items", [])
        return [item["link"] for item in items if "link" in item]

    except requests.exceptions.Timeout:
        logger.warning("Google search timed out for query: %s", query)
    except requests.exceptions.RequestException as exc:
        logger.warning("Google search request failed (%s): %s", type(exc).__name__, exc)
    except Exception as exc:
        logger.warning("Unexpected error during Google search: %s", exc)

    return []


def _fetch_page_text(url: str) -> str:
    """
    Fetch a URL, parse the HTML with BeautifulSoup, and return clean visible text.

    Stripping strategy
    ──────────────────
    1. Remove all noise tags (scripts, navs, footers, etc.).
    2. Prefer <main> / <article> / #content; fall back to <body>.
    3. Collapse whitespace.
    4. Truncate to MAX_PAGE_TEXT_CHARS so TF-IDF stays fast.

    Returns empty string on any failure.
    """
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": _BROWSER_UA},
            timeout=FETCH_TIMEOUT,
            allow_redirects=True,
        )

        if resp.status_code != 200:
            logger.debug("HTTP %d for %s — skipping", resp.status_code, url)
            return ""

        content_type = resp.headers.get("Content-Type", "")
        if "text/html" not in content_type:
            logger.debug("Non-HTML content-type (%s) for %s — skipping", content_type, url)
            return ""

        soup = BeautifulSoup(resp.text, "lxml")

        # ── Strip noise ───────────────────────────────────────────────────
        for tag in soup(_NOISE_TAGS):
            tag.decompose()

        # ── Find best content root ────────────────────────────────────────
        root = (
            soup.find("main")
            or soup.find("article")
            or soup.find(id=re.compile(r"(content|main|article)", re.I))
            or soup.body
        )
        if root is None:
            return ""

        raw_text = root.get_text(separator=" ", strip=True)
        clean_text = re.sub(r"\s+", " ", raw_text).strip()
        return clean_text[:MAX_PAGE_TEXT_CHARS]

    except requests.exceptions.Timeout:
        logger.debug("Fetch timed out for %s", url)
    except requests.exceptions.RequestException as exc:
        logger.debug("Fetch failed for %s: %s", url, exc)
    except Exception as exc:
        logger.debug("Unexpected error fetching %s: %s", url, exc)

    return ""


def _score_chunk_vs_page(chunk: str, page_text: str) -> tuple[float, str]:
    """
    Compare a single chunk against all sentences from a web page using TF-IDF.

    Returns
    ───────
    (max_similarity_score, best_matching_sentence_preview)

    A single shared TfidfVectorizer is fitted over [chunk] + [page_sentences]
    so the vocabulary is consistent.  Best matching sentence is at most 300 chars.
    """
    preprocessed_chunk = preprocess(chunk)
    if not preprocessed_chunk.strip():
        return 0.0, ""

    page_sentences = tokenize_text(page_text)

    # Build (preprocessed, original) pairs for valid page sentences
    valid_pairs: list[tuple[str, str]] = []
    for sent in page_sentences:
        p = preprocess(sent)
        if len(p.split()) >= MIN_TOKENS:
            valid_pairs.append((p, sent))

    if not valid_pairs:
        return 0.0, ""

    all_texts = [preprocessed_chunk] + [p for (p, _) in valid_pairs]

    try:
        vec = TfidfVectorizer(sublinear_tf=True, ngram_range=(1, 2), min_df=1)
        matrix = vec.fit_transform(all_texts)
        chunk_vec = matrix[0:1]
        page_vecs = matrix[1:]
        sims = cosine_similarity(chunk_vec, page_vecs)[0]
        best_idx = int(sims.argmax())
        best_score = float(sims[best_idx])
        best_preview = valid_pairs[best_idx][1][:300] if best_score > 0 else ""
        return best_score, best_preview
    except Exception as exc:
        logger.debug("TF-IDF comparison error: %s", exc)
        return 0.0, ""


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point  (sync — call via asyncio.to_thread in the async engine)
# ─────────────────────────────────────────────────────────────────────────────

def perform_web_matching(chunks: list[str]) -> list[WebMatchedChunk]:
    """
    For each searchable chunk:
      - Query Google Custom Search
      - Fetch result pages
      - Compare chunk vs page text with TF-IDF cosine similarity
      - Record a WebMatchedChunk if score ≥ WEB_SIMILARITY_THRESHOLD

    Designed to be called inside asyncio.to_thread() so it doesn't block
    the FastAPI event loop.

    Args:
        chunks: Original (non-preprocessed) sentence strings from the submission.

    Returns:
        List of WebMatchedChunk, sorted by descending similarity score.
    """
    results: list[WebMatchedChunk] = []
    # Deduplicate chunks so identical sentences aren't searched twice
    seen_chunks: set[str] = set()

    for chunk in chunks:
        if not _is_searchable(chunk):
            continue
        if chunk in seen_chunks:
            continue
        seen_chunks.add(chunk)

        query = _build_query(chunk)
        logger.debug("Web search query: %s", query)

        urls = _google_search(query)
        if not urls:
            time.sleep(INTER_QUERY_DELAY)
            continue

        matched_this_chunk = False
        for url in urls:
            if matched_this_chunk:
                break  # one confirmed web match per chunk is enough

            page_text = _fetch_page_text(url)
            if not page_text:
                continue

            score, preview = _score_chunk_vs_page(chunk, page_text)
            logger.debug("  %s → score=%.3f", url, score)

            if score >= WEB_SIMILARITY_THRESHOLD:
                results.append(
                    WebMatchedChunk(
                        chunk=chunk,
                        score=round(score, 4),
                        source_url=url,
                        matched_text_preview=preview or page_text[:200],
                    )
                )
                matched_this_chunk = True

        # Polite delay between Google API calls
        time.sleep(INTER_QUERY_DELAY)

    results.sort(key=lambda m: m.score, reverse=True)
    logger.info("Web matching complete: %d/%d chunks matched", len(results), len(seen_chunks))
    return results
