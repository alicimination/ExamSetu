"""
ExamSetu — Telegram notifications: alert matching users and admin error alerts.
Uses the free Telegram Bot API. Rate-limited to 25 msg/sec.
"""

import logging
import time
from datetime import date, timedelta

import requests as http_requests

from automation.config import TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, get_supabase

logger = logging.getLogger("examsetu.telegram")

TELEGRAM_API_BASE = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"


def send_message(chat_id: int | str, text: str, parse_mode: str = "HTML") -> bool:
    """Send a Telegram message. Returns True on success."""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set, skipping message")
        return False

    url = f"{TELEGRAM_API_BASE}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }

    try:
        response = http_requests.post(url, json=payload, timeout=10)
        result = response.json()

        if result.get("ok"):
            return True
        else:
            logger.error(f"Telegram send failed: {result.get('description')}")
            return False

    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return False


def send_admin_alert(message: str):
    """Send an alert message to the admin Telegram chat."""
    if not TELEGRAM_ADMIN_CHAT_ID:
        logger.warning("TELEGRAM_ADMIN_CHAT_ID not set")
        return
    send_message(TELEGRAM_ADMIN_CHAT_ID, f"⚠️ <b>ExamSetu Admin Alert</b>\n\n{message}")


def format_notification_alert(rule: dict, notification: dict) -> str:
    """Format a notification alert message for Telegram."""
    parts = [
        "🔔 <b>New Exam Notification Match!</b>",
        "",
        f"📋 <b>{notification.get('exam_body', '').upper()}</b> — {rule.get('post_name', 'Unknown Post')}",
    ]

    if rule.get("min_age") and rule.get("max_age"):
        age_str = f"📅 Age: {rule['min_age']}-{rule['max_age']}"
        relaxations = rule.get("category_relaxations", {})
        if relaxations:
            relax_parts = [f"{cat}: +{yrs}y" for cat, yrs in relaxations.items() if yrs > 0]
            if relax_parts:
                age_str += f" ({', '.join(relax_parts)})"
        parts.append(age_str)

    if rule.get("education_requirement"):
        parts.append(f"🎓 Education: {rule['education_requirement']}")

    if rule.get("domicile_requirement"):
        parts.append(f"📍 Domicile: {rule['domicile_requirement']}")

    notification_id = notification.get("id", "")
    parts.extend([
        "",
        f"🔍 <a href='https://examsetu.pages.dev/check/{notification_id}/'>Check Eligibility</a>",
        f"💬 <a href='https://examsetu.pages.dev/chat/{notification_id}/'>Ask Doubts</a>",
    ])

    if notification.get("pdf_url"):
        parts.append(f"📄 <a href='{notification['pdf_url']}'>Original PDF</a>")

    parts.extend([
        "",
        "⚠️ <i>Verify all details from the official notification before applying.</i>",
    ])

    return "\n".join(parts)


def check_user_match(user: dict, rule: dict) -> bool:
    """
    Check if a user profile matches an eligibility rule.
    This is a broad match — we notify if the user MIGHT be eligible.
    """
    # Check education level (hierarchy: 10th < 12th < Graduation < Post-Graduation)
    edu_hierarchy = {
        "10th": 1, "10th pass": 1,
        "12th": 2, "12th pass": 2, "intermediate": 2,
        "graduation": 3, "graduate": 3,
        "post-graduation": 4, "post-graduate": 4, "post graduation": 4,
    }

    user_edu = user.get("education", "").lower().strip()
    req_edu = (rule.get("education_requirement") or "").lower().strip()

    user_edu_level = edu_hierarchy.get(user_edu, 0)
    req_edu_level = 0
    for key, level in edu_hierarchy.items():
        if key in req_edu:
            req_edu_level = max(req_edu_level, level)

    if req_edu_level > 0 and user_edu_level < req_edu_level:
        return False  # User doesn't meet education requirement

    # Check domicile
    domicile_req = (rule.get("domicile_requirement") or "").lower()
    user_state = (user.get("state") or "").lower()
    if domicile_req and "none" not in domicile_req:
        if user_state and user_state not in domicile_req:
            return False

    # Check age (broad match — include users within possible range with relaxations)
    if user.get("dob") and rule.get("max_age"):
        user_dob = user["dob"]
        if isinstance(user_dob, str):
            user_dob = date.fromisoformat(user_dob)

        today = date.today()
        user_age = (today - user_dob).days / 365.25

        max_age = rule["max_age"]
        # Apply category relaxation
        category = (user.get("category") or "").upper()
        relaxations = rule.get("category_relaxations", {})
        relaxation_years = relaxations.get(category, 0)
        effective_max = max_age + relaxation_years

        # Apply gender relaxation
        gender = (user.get("gender") or "").lower()
        gender_relax = rule.get("gender_relaxations", {})
        gender_relax_years = gender_relax.get(gender, 0)
        effective_max += gender_relax_years

        min_age = rule.get("min_age", 0)

        if user_age < min_age or user_age > effective_max:
            return False

    return True  # User potentially matches


def notify_matching_users():
    """
    Find verified eligibility rules that haven't been notified yet,
    match them against user profiles, and send Telegram alerts.
    """
    supabase = get_supabase()

    # Get unnotified verified rules
    rules_result = supabase.table("eligibility_rules").select(
        "*, notifications(*)"
    ).eq("status", "verified").eq("notified", False).execute()

    rules = rules_result.data or []
    if not rules:
        logger.info("No new verified rules to notify about")
        return

    logger.info(f"Found {len(rules)} unnotified verified rule(s)")

    # Get all opted-in users
    users_result = supabase.table("user_profiles").select("*").eq(
        "opted_in_alerts", True
    ).execute()
    users = users_result.data or []

    if not users:
        logger.info("No opted-in users to notify")
        return

    logger.info(f"Checking against {len(users)} opted-in user(s)")

    messages_sent = 0

    for rule in rules:
        notification = rule.get("notifications", {})
        if not notification:
            continue

        for user in users:
            if check_user_match(user, rule):
                message = format_notification_alert(rule, notification)
                success = send_message(user["telegram_id"], message)

                if success:
                    messages_sent += 1
                    # Rate limit: max 25 messages per second
                    time.sleep(0.04)

        # Mark rule as notified
        try:
            supabase.table("eligibility_rules").update(
                {"notified": True}
            ).eq("id", rule["id"]).execute()
        except Exception as e:
            logger.error(f"Failed to mark rule {rule['id']} as notified: {e}")

    logger.info(f"Sent {messages_sent} notification(s) to matching users")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    notify_matching_users()
