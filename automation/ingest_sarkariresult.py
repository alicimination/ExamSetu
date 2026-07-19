"""
ExamSetu — End-to-end SarkariResult ingestion runner.
Scrapes job details, checks seen documents, inserts into Supabase Postgres,
extracts eligibility rules via Cerebras LLM, and stores Gemini vector embeddings.
"""

import sys
import hashlib
import logging
import time

from automation.config import get_supabase
from automation.scrape_sarkariresult import (
    fetch_latest_job_urls,
    parse_job_detail_page,
    EXCLUDED_PATHS,
)

EXCLUDED_PATHS.add("/latest-posts/")

from automation.rule_extraction import extract_rules
from automation.embed_and_store import embed_and_store

logger = logging.getLogger("examsetu.ingest_sarkariresult")


def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def ingest_sarkariresult_jobs(limit: int = 100) -> dict:
    """
    Scrape, extract, and ingest SarkariResult job notifications.
    """
    supabase = get_supabase()
    job_urls = fetch_latest_job_urls(limit=limit + 10)

    stats = {
        "discovered": len(job_urls),
        "processed": 0,
        "skipped": 0,
        "rules_extracted": 0,
        "chunks_embedded": 0,
        "errors": [],
    }

    logger.info("=" * 60)
    logger.info(f"ExamSetu — SarkariResult Ingestion Run (Processing up to {limit} new jobs)")
    logger.info("=" * 60)

    count = 0
    for job_info in job_urls:
        if count >= limit:
            break

        url = job_info["url"]

        # Parse job detail page
        try:
            detail = parse_job_detail_page(job_info)
        except Exception as e:
            logger.warning(f"Skipping {url} due to fetch error: {e}")
            stats["skipped"] += 1
            continue

        text = detail["full_text"]
        text_hash = compute_hash(text)

        # Check against seen_documents
        try:
            resp = (
                supabase.table("seen_documents")
                .select("pdf_url, pdf_hash")
                .eq("pdf_url", url)
                .maybe_single()
                .execute()
            )
            if resp and resp.data:
                logger.info(f"⏭️ Already seen: {detail['title'][:50]}")
                stats["skipped"] += 1
                continue
        except Exception as e:
            logger.warning(f"Error checking seen_documents for {url}: {e}")

        # Insert new notification (matching active Supabase Postgres schema)
        logger.info(f"\n🆕 Ingesting New Job: {detail['title']}")
        notif_payload = {
            "exam_body": detail["exam_body"],
            "title": detail["title"],
            "source_url": detail["source_url"],
            "pdf_url": detail["pdf_url"],
            "pdf_hash": text_hash,
            "vacancy_count": detail["vacancy_count"],
            "apply_start_date": detail.get("apply_start_date"),
            "apply_end_date": detail.get("apply_end_date"),
            "status": "pending_review",
        }

        try:
            res = supabase.table("notifications").insert(notif_payload).execute()
            if not res.data:
                logger.error(f"Failed to insert notification for {url}")
                continue
            notif_id = res.data[0]["id"]
            logger.info(f"  ✅ Inserted Notification ID: {notif_id}")

            # Insert into seen_documents
            seen_payload = {
                "pdf_url": url,
                "pdf_hash": text_hash,
                "notification_id": notif_id,
            }
            supabase.table("seen_documents").insert(seen_payload).execute()

        except Exception as e:
            logger.error(f"  ❌ DB insertion failed for {url}: {e}")
            stats["errors"].append(str(e))
            continue

        # Extract structured eligibility rules via Cerebras LLM
        try:
            rules = extract_rules(notif_id, text)
            stats["rules_extracted"] += len(rules)
            logger.info(f"  ✅ Extracted {len(rules)} rule(s) via Cerebras LLM")
        except Exception as e:
            logger.error(f"  ❌ Rule extraction failed: {e}")
            stats["errors"].append(str(e))

        # Generate RAG vector embeddings via Gemini
        try:
            chunks = embed_and_store(notif_id, text)
            stats["chunks_embedded"] += chunks
            logger.info(f"  ✅ Stored {chunks} vector chunks in Postgres pgvector")
        except Exception as e:
            logger.error(f"  ❌ RAG embedding failed: {e}")
            stats["errors"].append(str(e))

        # Mark notification and its extracted rules as verified so they display on frontend
        try:
            supabase.table("notifications").update({"status": "verified"}).eq("id", notif_id).execute()
            supabase.table("eligibility_rules").update({"status": "verified"}).eq("notification_id", notif_id).execute()
        except Exception as e:
            logger.warning(f"Failed to update status to verified: {e}")

        count += 1
        stats["processed"] += 1
        time.sleep(1.0)

    logger.info("\n" + "=" * 60)
    logger.info("Ingestion Complete:")
    logger.info(f"  Processed:       {stats['processed']}")
    logger.info(f"  Skipped (Seen):   {stats['skipped']}")
    logger.info(f"  Rules Extracted: {stats['rules_extracted']}")
    logger.info(f"  Chunks Embedded: {stats['chunks_embedded']}")
    logger.info("=" * 60)

    return stats


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    ingest_sarkariresult_jobs(limit=100)
