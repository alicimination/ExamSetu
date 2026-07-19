"""
ExamSetu — Multi-provider LLM client with automatic failover.

Providers (all free tier, no credit card):
  1. Groq    — Llama 3.3 70B, 30 RPM, ultra-fast (primary for chat)
  2. Cerebras — Llama 3.1 70B, 1M tokens/day (primary for extraction)
  3. Mistral  — Mistral Small, ~1B tokens/month (fallback)

All use OpenAI-compatible API format via the `openai` Python client.
"""

import time
import hashlib
import json
import logging
from typing import Optional

from openai import OpenAI

from automation.config import (
    GROQ_API_KEY, CEREBRAS_API_KEY, MISTRAL_API_KEY,
    GROQ_MODEL, CEREBRAS_MODEL, MISTRAL_MODEL,
    get_supabase,
)

logger = logging.getLogger("examsetu.llm")

# ── Provider configurations ───────────────────────────────────

PROVIDERS = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "api_key": GROQ_API_KEY,
        "model": GROQ_MODEL,
        "label": "Groq",
    },
    "cerebras": {
        "base_url": "https://api.cerebras.ai/v1",
        "api_key": CEREBRAS_API_KEY,
        "model": CEREBRAS_MODEL,
        "label": "Cerebras",
    },
    "mistral": {
        "base_url": "https://api.mistral.ai/v1",
        "api_key": MISTRAL_API_KEY,
        "model": MISTRAL_MODEL,
        "label": "Mistral",
    },
}

# Failover order for different use cases
CHAT_ORDER = ["groq", "cerebras", "mistral"]       # Groq first (fast)
EXTRACTION_ORDER = ["cerebras", "mistral", "groq"]  # Cerebras first (throughput)


def _get_client(provider_name: str) -> Optional[OpenAI]:
    """Create an OpenAI-compatible client for the given provider."""
    provider = PROVIDERS.get(provider_name)
    if not provider or not provider["api_key"]:
        return None
    return OpenAI(
        base_url=provider["base_url"],
        api_key=provider["api_key"],
    )


def _log_usage(provider: str, model: str, purpose: str,
               tokens_in: int, tokens_out: int, latency_ms: int,
               success: bool, error_message: str = None):
    """Log LLM usage to Supabase for monitoring."""
    try:
        supabase = get_supabase()
        supabase.table("llm_usage_log").insert({
            "provider": provider,
            "model": model,
            "purpose": purpose,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "latency_ms": latency_ms,
            "success": success,
            "error_message": error_message,
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to log LLM usage: {e}")


def call_llm(
    messages: list[dict],
    purpose: str = "chat",
    provider_order: list[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
    response_format: dict = None,
) -> dict:
    """
    Call an LLM with automatic failover across free-tier providers.

    Args:
        messages: OpenAI-format messages list
        purpose: "chat" | "extraction" | "diff" — determines failover order
        provider_order: Explicit provider order (overrides purpose-based default)
        temperature: Sampling temperature
        max_tokens: Max response tokens
        response_format: Optional {"type": "json_object"} for structured output

    Returns:
        {"content": str, "provider": str, "model": str, "tokens_in": int, "tokens_out": int}

    Raises:
        RuntimeError: If all providers fail
    """
    if provider_order is None:
        if purpose == "extraction" or purpose == "diff":
            provider_order = EXTRACTION_ORDER
        else:
            provider_order = CHAT_ORDER

    errors = []

    for provider_name in provider_order:
        provider = PROVIDERS.get(provider_name)
        if not provider or not provider["api_key"]:
            continue

        client = _get_client(provider_name)
        if client is None:
            continue

        start_time = time.time()
        try:
            kwargs = {
                "model": provider["model"],
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_format:
                kwargs["response_format"] = response_format

            response = client.chat.completions.create(**kwargs)

            latency_ms = int((time.time() - start_time) * 1000)
            tokens_in = response.usage.prompt_tokens if response.usage else 0
            tokens_out = response.usage.completion_tokens if response.usage else 0
            content = response.choices[0].message.content

            _log_usage(
                provider=provider_name,
                model=provider["model"],
                purpose=purpose,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                latency_ms=latency_ms,
                success=True,
            )

            logger.info(
                f"LLM call success: {provider['label']} | {purpose} | "
                f"{tokens_in}+{tokens_out} tokens | {latency_ms}ms"
            )

            return {
                "content": content,
                "provider": provider_name,
                "model": provider["model"],
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
            }

        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            errors.append(f"{provider['label']}: {error_msg}")

            _log_usage(
                provider=provider_name,
                model=provider["model"],
                purpose=purpose,
                tokens_in=0,
                tokens_out=0,
                latency_ms=latency_ms,
                success=False,
                error_message=error_msg[:500],
            )

            # Check if it's a rate limit error (429) — try next provider
            if "429" in error_msg or "rate" in error_msg.lower():
                logger.warning(
                    f"Rate limited on {provider['label']}, trying next provider..."
                )
                continue

            # For other errors, also try next provider
            logger.warning(
                f"Error on {provider['label']}: {error_msg[:200]}. Trying next..."
            )
            continue

    # All providers failed
    error_summary = " | ".join(errors)
    raise RuntimeError(f"All LLM providers failed: {error_summary}")


def call_llm_json(
    messages: list[dict],
    purpose: str = "extraction",
    **kwargs,
) -> dict:
    """
    Call LLM and parse the response as JSON.
    Adds response_format hint and retries parsing.
    """
    # Add JSON instruction to system message if not already present
    if messages and messages[0]["role"] == "system":
        if "JSON" not in messages[0]["content"]:
            messages[0]["content"] += "\n\nRespond with valid JSON only, no markdown fences."

    result = call_llm(
        messages=messages,
        purpose=purpose,
        response_format={"type": "json_object"},
        **kwargs,
    )

    content = result["content"].strip()

    # Strip markdown code fences if present
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])

    try:
        parsed = json.loads(content)
        result["parsed"] = parsed
        return result
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON response: {e}\nContent: {content[:500]}")
        raise ValueError(f"LLM returned invalid JSON: {e}")


def get_cache_key(question: str, notification_id: str) -> str:
    """Generate a cache key for RAG responses."""
    normalized = question.strip().lower()
    return hashlib.sha256(f"{notification_id}:{normalized}".encode()).hexdigest()


def get_cached_response(notification_id: str, question: str) -> Optional[dict]:
    """Check if we have a cached RAG response."""
    try:
        supabase = get_supabase()
        cache_key = get_cache_key(question, notification_id)
        result = supabase.table("chat_cache").select("answer, citations").eq(
            "notification_id", notification_id
        ).eq("question_hash", cache_key).gt(
            "expires_at", "now()"
        ).maybe_single().execute()

        if result.data:
            return result.data
    except Exception as e:
        logger.warning(f"Cache lookup failed: {e}")
    return None


def cache_response(notification_id: str, question: str, answer: str, citations: list):
    """Cache a RAG response to reduce future LLM calls."""
    try:
        supabase = get_supabase()
        cache_key = get_cache_key(question, notification_id)
        supabase.table("chat_cache").upsert({
            "notification_id": notification_id,
            "question_hash": cache_key,
            "answer": answer,
            "citations": citations,
        }).execute()
    except Exception as e:
        logger.warning(f"Cache write failed: {e}")
