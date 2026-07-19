"""
ExamSetu — Text chunking and embedding with Gemini, stored in Supabase pgvector.
Uses Gemini Embedding API (free tier, via Google AI Studio — no billing enabled).
"""

import logging
import time
from typing import Optional

from google import genai

from automation.config import (
    GEMINI_API_KEY, GEMINI_EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS, CHUNK_SIZE, CHUNK_OVERLAP,
    get_supabase,
)

logger = logging.getLogger("examsetu.embed")

# Initialize Gemini client
_gemini_client = None


def get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY must be set for embeddings")
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini_client


def chunk_text(
    text: str,
    pages: list[dict] = None,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[dict]:
    """
    Split text into overlapping chunks, preserving page references.

    Returns list of {"text": str, "chunk_index": int, "page_ref": int}
    """
    # If we have page-level text, chunk within pages
    if pages:
        chunks = []
        chunk_index = 0

        for page_info in pages:
            page_text = page_info["text"].strip()
            page_no = page_info["page_no"]

            if not page_text:
                continue

            # Split into words for approximate token count
            words = page_text.split()
            start = 0

            while start < len(words):
                end = min(start + chunk_size, len(words))
                chunk_text_str = " ".join(words[start:end])

                if chunk_text_str.strip():
                    chunks.append({
                        "text": chunk_text_str,
                        "chunk_index": chunk_index,
                        "page_ref": page_no,
                    })
                    chunk_index += 1

                start = end - overlap if end < len(words) else end

        return chunks

    # Fallback: chunk the full text without page references
    words = text.split()
    chunks = []
    chunk_index = 0
    start = 0

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_text_str = " ".join(words[start:end])

        if chunk_text_str.strip():
            chunks.append({
                "text": chunk_text_str,
                "chunk_index": chunk_index,
                "page_ref": None,
            })
            chunk_index += 1

        start = end - overlap if end < len(words) else end

    return chunks


def generate_embeddings(texts: list[str], batch_size: int = 20) -> list[list[float]]:
    """
    Generate embeddings using Gemini Embedding API.
    Batches requests and rate-limits to stay within free tier.

    Returns list of embedding vectors (768-dim).
    """
    client = get_gemini_client()
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]

        try:
            result = client.models.embed_content(
                model=GEMINI_EMBEDDING_MODEL,
                contents=batch,
                config={
                    "output_dimensionality": EMBEDDING_DIMENSIONS,
                },
            )

            for embedding in result.embeddings:
                all_embeddings.append(embedding.values)

            logger.info(f"Embedded batch {i // batch_size + 1}: {len(batch)} texts")

            # Rate limit: wait between batches to stay within free tier
            if i + batch_size < len(texts):
                time.sleep(1)

        except Exception as e:
            logger.error(f"Embedding failed for batch starting at {i}: {e}")
            # Fill with None to maintain index alignment
            all_embeddings.extend([None] * len(batch))

    return all_embeddings


def embed_and_store(
    notification_id: str,
    full_text: str,
    pages: list[dict] = None,
) -> int:
    """
    Chunk text, generate embeddings, and store in Supabase pgvector.

    Args:
        notification_id: UUID of the notification
        full_text: Full extracted text
        pages: Optional per-page text list

    Returns:
        Number of chunks stored
    """
    supabase = get_supabase()

    # Delete existing chunks for this notification (in case of re-processing)
    try:
        supabase.table("document_chunks").delete().eq(
            "notification_id", notification_id
        ).execute()
    except Exception:
        pass

    # Chunk the text
    chunks = chunk_text(full_text, pages=pages)
    if not chunks:
        logger.warning(f"No chunks generated for {notification_id}")
        return 0

    logger.info(f"Generated {len(chunks)} chunks for notification {notification_id}")

    # Generate embeddings
    texts_to_embed = [c["text"] for c in chunks]
    embeddings = generate_embeddings(texts_to_embed)

    # Store in database
    stored_count = 0
    for chunk, embedding in zip(chunks, embeddings):
        if embedding is None:
            logger.warning(f"Skipping chunk {chunk['chunk_index']} — embedding failed")
            continue

        row = {
            "notification_id": notification_id,
            "chunk_text": chunk["text"],
            "chunk_index": chunk["chunk_index"],
            "page_ref": chunk["page_ref"],
            "embedding": embedding,
        }

        try:
            supabase.table("document_chunks").insert(row).execute()
            stored_count += 1
        except Exception as e:
            logger.error(f"Failed to store chunk {chunk['chunk_index']}: {e}")

    logger.info(f"Stored {stored_count}/{len(chunks)} chunks for {notification_id}")
    return stored_count
