"""
ExamSetu — Corrigendum / change detection between notification versions.
Compares new PDF text against stored previous version, generates a diff summary.
"""

import difflib
import logging

from automation.config import get_supabase
from automation.llm_client import call_llm

logger = logging.getLogger("examsetu.diff")


def get_previous_text(notification_id: str) -> str | None:
    """Retrieve the stored text of a notification's previous version from chunks."""
    supabase = get_supabase()
    try:
        result = supabase.table("document_chunks").select(
            "chunk_text, chunk_index"
        ).eq("notification_id", notification_id).order(
            "chunk_index"
        ).execute()

        if result.data:
            return "\n".join([c["chunk_text"] for c in result.data])
    except Exception as e:
        logger.warning(f"Could not retrieve previous text: {e}")
    return None


def compute_text_diff(old_text: str, new_text: str) -> str:
    """Compute a unified diff between old and new text."""
    old_lines = old_text.splitlines(keepends=True)
    new_lines = new_text.splitlines(keepends=True)

    diff = difflib.unified_diff(
        old_lines, new_lines,
        fromfile="Previous Version",
        tofile="Updated Version",
        lineterm="",
    )
    return "\n".join(diff)


def summarize_changes(diff_text: str, old_text: str, new_text: str) -> str:
    """
    Use LLM to generate a plain-language summary of changes.
    """
    if not diff_text.strip():
        return "No significant changes detected."

    # Truncate diff if too long
    diff_truncated = diff_text[:5000]

    messages = [
        {
            "role": "system",
            "content": (
                "You are an assistant that summarizes changes in Indian government "
                "exam notifications. Given a text diff between two versions of a "
                "notification, produce a clear, concise summary of what changed. "
                "Focus on: dates changed, vacancy numbers changed, eligibility "
                "criteria modified, fee changes, or any correction/erratum. "
                "Write in simple English that a student can understand. "
                "Use bullet points."
            ),
        },
        {
            "role": "user",
            "content": f"Here is the diff between the old and new notification:\n\n{diff_truncated}",
        },
    ]

    try:
        result = call_llm(messages, purpose="diff")
        return result["content"]
    except Exception as e:
        logger.error(f"LLM diff summary failed: {e}")
        # Fallback: return a simple mechanical diff summary
        added = len([l for l in diff_text.split("\n") if l.startswith("+")])
        removed = len([l for l in diff_text.split("\n") if l.startswith("-")])
        return f"Changes detected: {added} lines added, {removed} lines removed. Please review the updated PDF manually."


def detect_and_record_corrigendum(
    notification_id: str,
    new_text: str,
    new_pdf_hash: str,
    new_pdf_url: str = None,
) -> dict | None:
    """
    Check if a notification has changed, and if so, record the corrigendum.

    Args:
        notification_id: UUID of the existing notification
        new_text: Text from the newly downloaded PDF
        new_pdf_hash: SHA-256 hash of the new PDF
        new_pdf_url: URL of the new PDF (if different)

    Returns:
        Version record dict, or None if no changes
    """
    supabase = get_supabase()

    # Get current notification
    notification = supabase.table("notifications").select(
        "pdf_hash"
    ).eq("id", notification_id).single().execute()

    if notification.data["pdf_hash"] == new_pdf_hash:
        logger.info(f"No changes for notification {notification_id}")
        return None

    # Get previous text for comparison
    old_text = get_previous_text(notification_id)
    if old_text is None:
        diff_summary = "First version recorded. Unable to compute diff."
    else:
        diff_text = compute_text_diff(old_text, new_text)
        diff_summary = summarize_changes(diff_text, old_text, new_text)

    # Get next version number
    versions = supabase.table("notification_versions").select(
        "version_no"
    ).eq("notification_id", notification_id).order(
        "version_no", desc=True
    ).limit(1).execute()

    next_version = (versions.data[0]["version_no"] + 1) if versions.data else 2

    # Insert version record
    version_data = {
        "notification_id": notification_id,
        "version_no": next_version,
        "pdf_hash": new_pdf_hash,
        "pdf_url": new_pdf_url,
        "diff_summary": diff_summary,
    }

    supabase.table("notification_versions").insert(version_data).execute()

    # Update the notification's hash
    update_data = {"pdf_hash": new_pdf_hash}
    if new_pdf_url:
        update_data["pdf_url"] = new_pdf_url
    supabase.table("notifications").update(update_data).eq(
        "id", notification_id
    ).execute()

    # Update seen_documents
    supabase.table("seen_documents").update(
        {"pdf_hash": new_pdf_hash}
    ).eq("notification_id", notification_id).execute()

    logger.info(f"Recorded corrigendum v{next_version} for {notification_id}")
    return version_data
