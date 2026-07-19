"""
ExamSetu — Pipeline orchestrator.
Runs the full ingestion pipeline: scrape → download → OCR → extract rules → embed → notify.
Handles errors per-document so one failure doesn't stop the batch.
"""

import logging
import sys
import time

from automation.config import PROJECT_ROOT
from automation.scrape import scrape_all_sources
from automation.download import process_new_pdf
from automation.ocr_extract import extract_text
from automation.rule_extraction import extract_rules
from automation.embed_and_store import embed_and_store
from automation.diff_corrigendum import detect_and_record_corrigendum
from automation.notify_telegram import notify_matching_users, send_admin_alert

logger = logging.getLogger("examsetu.pipeline")


def run_pipeline():
    """
    Full ingestion pipeline orchestrator.
    Processes each document independently — one failure doesn't stop others.
    """
    start_time = time.time()
    stats = {
        "sources_scraped": 0,
        "new_pdfs_found": 0,
        "pdfs_downloaded": 0,
        "pdfs_extracted": 0,
        "rules_extracted": 0,
        "chunks_embedded": 0,
        "errors": [],
    }

    logger.info("=" * 60)
    logger.info("ExamSetu Pipeline — Starting ingestion run")
    logger.info("=" * 60)

    # ── Step 1: Scrape all enabled sources ─────────────────────
    logger.info("\n📡 Step 1: Scraping notification sources...")
    try:
        scrape_results = scrape_all_sources()
        stats["sources_scraped"] = len(scrape_results)
    except Exception as e:
        error_msg = f"Scraping failed entirely: {e}"
        logger.error(error_msg)
        stats["errors"].append(error_msg)
        send_admin_alert(f"❌ Pipeline scraping failed: {e}")
        return stats

    # Collect all new PDFs across sources
    new_pdfs = []
    for result in scrape_results:
        source_id = result["source_id"]
        source_url = ""
        for link in result.get("new", []):
            link["source_id"] = source_id
            link["source_url"] = source_url
            new_pdfs.append(link)

    stats["new_pdfs_found"] = len(new_pdfs)
    logger.info(f"Found {len(new_pdfs)} new PDF(s) to process")

    if not new_pdfs:
        logger.info("No new notifications found. Pipeline complete.")
        # Still run notification matching (in case rules were manually verified since last run)
        try:
            notify_matching_users()
        except Exception as e:
            logger.warning(f"Notification matching failed: {e}")
        return stats

    # ── Step 2-5: Process each new PDF ─────────────────────────
    for i, pdf_info in enumerate(new_pdfs, 1):
        pdf_url = pdf_info["url"]
        source_id = pdf_info["source_id"]
        title = pdf_info.get("title", "Untitled")

        logger.info(f"\n{'─' * 40}")
        logger.info(f"Processing PDF {i}/{len(new_pdfs)}: {title[:60]}")
        logger.info(f"Source: {source_id} | URL: {pdf_url}")

        # Step 2: Download
        try:
            download_result = process_new_pdf(
                source_id=source_id,
                link_info=pdf_info,
                source_url=pdf_info.get("source_url", ""),
            )
            notification_id = download_result["notification_id"]
            local_path = download_result["local_path"]
            stats["pdfs_downloaded"] += 1
            logger.info(f"  ✅ Downloaded: {local_path.name}")
        except Exception as e:
            error_msg = f"Download failed for {pdf_url}: {e}"
            logger.error(f"  ❌ {error_msg}")
            stats["errors"].append(error_msg)
            continue

        # Step 3: OCR / Text extraction
        try:
            text_result = extract_text(local_path)
            full_text = text_result["full_text"]
            pages = text_result["pages"]
            stats["pdfs_extracted"] += 1
            logger.info(
                f"  ✅ Extracted text: {len(full_text)} chars, "
                f"{text_result['total_pages']} pages ({text_result['method']})"
            )
        except Exception as e:
            error_msg = f"Text extraction failed for {notification_id}: {e}"
            logger.error(f"  ❌ {error_msg}")
            stats["errors"].append(error_msg)
            continue

        # Step 4: LLM rule extraction
        try:
            rules = extract_rules(notification_id, full_text)
            stats["rules_extracted"] += len(rules)
            logger.info(f"  ✅ Extracted {len(rules)} eligibility rule(s)")
        except Exception as e:
            error_msg = f"Rule extraction failed for {notification_id}: {e}"
            logger.error(f"  ❌ {error_msg}")
            stats["errors"].append(error_msg)
            # Continue to embedding even if rule extraction fails

        # Step 5: Embed and store for RAG
        try:
            chunks_stored = embed_and_store(notification_id, full_text, pages=pages)
            stats["chunks_embedded"] += chunks_stored
            logger.info(f"  ✅ Stored {chunks_stored} text chunks with embeddings")
        except Exception as e:
            error_msg = f"Embedding failed for {notification_id}: {e}"
            logger.error(f"  ❌ {error_msg}")
            stats["errors"].append(error_msg)

    # ── Step 6: Notify matching users ──────────────────────────
    logger.info(f"\n📲 Step 6: Matching and notifying users...")
    try:
        notify_matching_users()
    except Exception as e:
        error_msg = f"User notification failed: {e}"
        logger.error(error_msg)
        stats["errors"].append(error_msg)

    # ── Summary ────────────────────────────────────────────────
    elapsed = time.time() - start_time
    logger.info(f"\n{'=' * 60}")
    logger.info("Pipeline Summary:")
    logger.info(f"  Sources scraped:  {stats['sources_scraped']}")
    logger.info(f"  New PDFs found:   {stats['new_pdfs_found']}")
    logger.info(f"  PDFs downloaded:  {stats['pdfs_downloaded']}")
    logger.info(f"  PDFs extracted:   {stats['pdfs_extracted']}")
    logger.info(f"  Rules extracted:  {stats['rules_extracted']}")
    logger.info(f"  Chunks embedded:  {stats['chunks_embedded']}")
    logger.info(f"  Errors:           {len(stats['errors'])}")
    logger.info(f"  Total time:       {elapsed:.1f}s")
    logger.info("=" * 60)

    # Alert admin if there were errors
    if stats["errors"]:
        error_summary = "\n".join(f"• {e[:100]}" for e in stats["errors"][:5])
        send_admin_alert(
            f"Pipeline completed with {len(stats['errors'])} error(s):\n\n{error_summary}"
        )

    return stats


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    run_pipeline()

