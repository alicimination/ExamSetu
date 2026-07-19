"""
ExamSetu — Rule extraction from notification text using LLM.
Uses Cerebras (primary) with Mistral fallback.
Extracts structured eligibility rules and inserts with status='pending_review'.
"""

import json
import logging

from automation.config import get_supabase
from automation.llm_client import call_llm_json

logger = logging.getLogger("examsetu.rules")

EXTRACTION_PROMPT = """You are an expert at reading Indian government job notification documents.
Extract ALL eligibility rules from the following notification text.

For EACH post mentioned in the notification, extract:
1. post_name: The name of the post (in English)
2. min_age: Minimum age required (integer)
3. max_age: Maximum age required for General category (integer)
4. category_relaxations: Age relaxation in YEARS for each category as JSON object
   Example: {"OBC": 3, "SC": 5, "ST": 5, "EWS": 0, "PH": 10}
5. gender_relaxations: Age relaxation for gender as JSON object
   Example: {"female": 5} (if females get 5 years relaxation)
6. education_requirement: Required education (e.g. "Graduate in any discipline", "12th pass")
7. domicile_requirement: State/domicile requirement (e.g. "Uttar Pradesh" or "None")
8. additional_requirements: Any other requirements (physical standards, experience, etc.)
9. fee_general: Application fee for General/OBC in INR (integer or null)
10. fee_reserved: Application fee for SC/ST/PwD in INR (integer or null)
11. source_page_ref: Which page/section this info comes from
12. extraction_confidence: Your confidence 0.0 to 1.0 that the extraction is correct

IMPORTANT:
- Extract age as of the reference/cut-off date mentioned in the notification
- If the notification is in Hindi, translate field values to English
- If a field is not found, set it to null
- Be precise about category_relaxations — these directly affect eligibility decisions
- If multiple posts are listed, create a separate entry for EACH post

Respond with a JSON object: {"posts": [<array of extracted post objects>]}"""


def extract_rules(notification_id: str, extracted_text: str) -> list[dict]:
    """
    Extract eligibility rules from notification text using LLM.

    Args:
        notification_id: UUID of the notification
        extracted_text: Full text extracted from the PDF

    Returns:
        List of extracted rule dicts inserted into the database
    """
    # Truncate very long texts to fit within context window
    max_chars = 15000  # ~4K tokens
    text_for_llm = extracted_text[:max_chars]
    if len(extracted_text) > max_chars:
        text_for_llm += "\n\n[... text truncated for processing ...]"

    messages = [
        {"role": "system", "content": EXTRACTION_PROMPT},
        {"role": "user", "content": f"Here is the notification text:\n\n{text_for_llm}"},
    ]

    try:
        result = call_llm_json(messages, purpose="extraction")
        parsed = result["parsed"]

        posts = parsed.get("posts", [])
        if not posts:
            logger.warning(f"No posts extracted for notification {notification_id}")
            return []

        logger.info(f"Extracted {len(posts)} post(s) from notification {notification_id}")

    except Exception as e:
        logger.error(f"Rule extraction failed for {notification_id}: {e}")
        return []

    # Insert extracted rules into database
    supabase = get_supabase()
    inserted_rules = []

    for post in posts:
        rule_data = {
            "notification_id": notification_id,
            "post_name": post.get("post_name", "Unknown Post"),
            "min_age": post.get("min_age"),
            "max_age": post.get("max_age"),
            "category_relaxations": post.get("category_relaxations", {}),
            "gender_relaxations": post.get("gender_relaxations", {}),
            "education_requirement": post.get("education_requirement"),
            "domicile_requirement": post.get("domicile_requirement"),
            "additional_requirements": post.get("additional_requirements"),
            "fee_general": post.get("fee_general"),
            "fee_reserved": post.get("fee_reserved"),
            "source_page_ref": post.get("source_page_ref"),
            "extraction_confidence": post.get("extraction_confidence", 0.5),
            "status": "pending_review",
        }

        try:
            supabase.table("eligibility_rules").insert(rule_data).execute()
            inserted_rules.append(rule_data)
            logger.info(f"  Inserted rule: {rule_data['post_name']} (confidence: {rule_data['extraction_confidence']})")
        except Exception as e:
            logger.error(f"  Failed to insert rule for {rule_data['post_name']}: {e}")

    # Update notification status
    try:
        supabase.table("notifications").update(
            {"status": "pending_review"}
        ).eq("id", notification_id).execute()
    except Exception as e:
        logger.warning(f"Failed to update notification status: {e}")

    return inserted_rules
