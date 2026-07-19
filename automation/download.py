"""
ExamSetu — PDF downloader with hash computation and Supabase Storage upload.
All downloads go to project-local automation/downloads/ directory.
"""

import hashlib
import logging
import uuid
from pathlib import Path

import requests

from automation.config import DOWNLOADS_DIR, USER_AGENT, REQUEST_TIMEOUT, get_supabase
from automation.scrape import _get_session

logger = logging.getLogger("examsetu.download")


def compute_sha256(file_path: Path) -> str:
    """Compute SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def download_pdf(url: str, notification_id: str = None) -> dict:
    """
    Download a PDF to the project-local downloads directory.

    Args:
        url: URL of the PDF to download
        notification_id: Optional UUID to use as folder name

    Returns:
        {
            "local_path": Path,
            "pdf_hash": str,
            "notification_id": str,
            "file_size": int,
        }
    """
    if notification_id is None:
        notification_id = str(uuid.uuid4())

    # Create notification-specific download directory
    download_dir = DOWNLOADS_DIR / notification_id
    download_dir.mkdir(parents=True, exist_ok=True)

    # Extract filename from URL or use default
    filename = url.split("/")[-1].split("?")[0]
    if not filename.endswith(".pdf"):
        filename = f"notification_{notification_id[:8]}.pdf"

    local_path = download_dir / filename

    # Download the PDF
    headers = {"User-Agent": USER_AGENT}
    session = _get_session()
    try:
        response = session.get(url, headers=headers, timeout=REQUEST_TIMEOUT, stream=True, verify=False)
        response.raise_for_status()

        with open(local_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        file_size = local_path.stat().st_size
        pdf_hash = compute_sha256(local_path)

        logger.info(f"Downloaded: {filename} ({file_size / 1024:.1f} KB) hash={pdf_hash[:12]}...")

        return {
            "local_path": local_path,
            "pdf_hash": pdf_hash,
            "notification_id": notification_id,
            "file_size": file_size,
        }

    except requests.RequestException as e:
        logger.error(f"Failed to download {url}: {e}")
        raise


def upload_to_storage(local_path: Path, notification_id: str) -> str:
    """
    Upload a PDF to Supabase Storage.
    Returns the storage path.
    """
    supabase = get_supabase()
    storage_path = f"{notification_id}/{local_path.name}"

    try:
        with open(local_path, "rb") as f:
            supabase.storage.from_("notification-pdfs").upload(
                storage_path,
                f.read(),
                file_options={"content-type": "application/pdf"},
            )
        logger.info(f"Uploaded to storage: {storage_path}")
        return storage_path

    except Exception as e:
        # If file already exists, that's fine
        if "Duplicate" in str(e) or "already exists" in str(e).lower():
            logger.info(f"File already in storage: {storage_path}")
            return storage_path
        logger.error(f"Failed to upload to storage: {e}")
        raise


def register_notification(
    notification_id: str,
    source_id: str,
    title: str,
    source_url: str,
    pdf_url: str,
    pdf_hash: str,
    storage_path: str = None,
) -> str:
    """
    Create a new notification record in the database.
    Returns the notification_id.
    """
    supabase = get_supabase()

    data = {
        "id": notification_id,
        "exam_body": source_id,
        "title": title,
        "source_url": source_url,
        "pdf_url": pdf_url,
        "pdf_hash": pdf_hash,
        "pdf_storage_path": storage_path,
        "status": "new",
    }

    supabase.table("notifications").insert(data).execute()

    # Record in seen_documents for future change detection
    supabase.table("seen_documents").upsert({
        "pdf_url": pdf_url,
        "pdf_hash": pdf_hash,
        "notification_id": notification_id,
    }).execute()

    logger.info(f"Registered notification: {notification_id} -- {title[:60]}")
    return notification_id


def process_new_pdf(source_id: str, link_info: dict, source_url: str = "") -> dict:
    """
    Full download pipeline for a newly discovered PDF.

    Args:
        source_id: e.g. "upsssc"
        link_info: {"url": str, "title": str}
        source_url: The listing page URL where the link was found

    Returns:
        {"notification_id": str, "local_path": Path, "pdf_hash": str}
    """
    pdf_url = link_info["url"]
    title = link_info.get("title", "Untitled Notification")

    # Download
    download_result = download_pdf(pdf_url)
    notification_id = download_result["notification_id"]
    pdf_hash = download_result["pdf_hash"]
    local_path = download_result["local_path"]

    # Upload to Supabase Storage
    try:
        storage_path = upload_to_storage(local_path, notification_id)
    except Exception as e:
        logger.warning(f"Storage upload failed, continuing without: {e}")
        storage_path = None

    # Register in database — use the SAME notification_id from download
    register_notification(
        notification_id=notification_id,
        source_id=source_id,
        title=title,
        source_url=source_url or pdf_url,
        pdf_url=pdf_url,
        pdf_hash=pdf_hash,
        storage_path=storage_path,
    )

    return {
        "notification_id": notification_id,
        "local_path": local_path,
        "pdf_hash": pdf_hash,
    }
