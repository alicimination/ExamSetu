"""
ExamSetu — Shared configuration for automation scripts.
All paths resolve to project-local directories. Nothing outside the repo.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# ── Project root & paths ─────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOWNLOADS_DIR = PROJECT_ROOT / "automation" / "downloads"
CACHE_DIR = PROJECT_ROOT / ".cache"
DATA_SOURCES_FILE = PROJECT_ROOT / "data_sources" / "sources.yaml"

# Create project-local directories
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ── Load environment variables ────────────────────────────────
# Load from .env if it exists (local dev); in CI, env vars come from secrets
env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    load_dotenv(env_path)

# ── Required environment variables ────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
CEREBRAS_API_KEY = os.environ.get("CEREBRAS_API_KEY", "")
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ADMIN_CHAT_ID = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")

CF_DEPLOY_HOOK_URL = os.environ.get("CF_DEPLOY_HOOK_URL", "")

# ── Supabase client ───────────────────────────────────────────
_supabase_client = None


def get_supabase():
    """Lazy-initialize Supabase client with service role key."""
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
            sys.exit(1)
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _supabase_client


# ── Constants ─────────────────────────────────────────────────
USER_AGENT = "ExamSetu/1.0 (Government Notification Tracker; +https://github.com/examsetu)"
REQUEST_TIMEOUT = 30  # seconds
CHUNK_SIZE = 500       # tokens per chunk for embedding
CHUNK_OVERLAP = 50     # token overlap between chunks
EMBEDDING_DIMENSIONS = 768  # Gemini MRL dimension (saves storage vs 3072 default)

# LLM model identifiers
GROQ_MODEL = "llama-3.3-70b-versatile"
CEREBRAS_MODEL = "gpt-oss-120b"
MISTRAL_MODEL = "mistral-small-latest"
GEMINI_EMBEDDING_MODEL = "gemini-embedding-2"
