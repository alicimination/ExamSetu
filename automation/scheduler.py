"""
ExamSetu — Near-Instant Job Ingestion Scheduler Daemon.
Monitors SarkariResult Latest Jobs feed at high frequency (default: 5-minute interval).
Performs fast deduplication checks and triggers the end-to-end ingestion pipeline
only when new, unseen recruitment notices are detected.
"""

import sys
import time
import argparse
import logging
from datetime import datetime

from automation.config import get_supabase
from automation.scrape_sarkariresult import fetch_latest_job_urls
from automation.ingest_sarkariresult import ingest_sarkariresult_jobs

logger = logging.getLogger("examsetu.scheduler")


def check_and_ingest(limit: int = 15) -> int:
    """
    Performs a fast discovery check for new jobs.
    Returns the number of new jobs ingested.
    """
    start_time = datetime.now()
    logger.info(f"[{start_time.strftime('%Y-%m-%d %H:%M:%S')}] Checking SarkariResult feed for new jobs...")

    try:
        job_urls = fetch_latest_job_urls(limit=limit)
    except Exception as e:
        logger.error(f"Failed to fetch job URLs from feed: {e}")
        return 0

    if not job_urls:
        logger.info("No job URLs retrieved from feed.")
        return 0

    # Quick deduplication check against database seen_documents
    supabase = get_supabase()
    unseen_jobs = []

    for job in job_urls:
        url = job["url"]
        try:
            res = (
                supabase.table("seen_documents")
                .select("pdf_url")
                .eq("pdf_url", url)
                .maybe_single()
                .execute()
            )
            if not res or not res.data:
                unseen_jobs.append(job)
        except Exception as e:
            logger.warning(f"DB check error for {url}: {e}")
            unseen_jobs.append(job)

    if not unseen_jobs:
        logger.info("⚡ Feed check complete: 0 new jobs. All posts are up to date.")
        return 0

    logger.info(f"🚨 DISCOVERED {len(unseen_jobs)} NEW JOB(S)! Triggering ingestion pipeline...")
    for j in unseen_jobs:
        logger.info(f"  → New Job: {j['title']} ({j['url']})")

    # Execute ingestion run
    stats = ingest_sarkariresult_jobs(limit=len(unseen_jobs))
    logger.info(f"✅ Ingestion complete. Ingested: {stats.get('processed', 0)} post(s).")
    return stats.get("processed", 0)


def run_scheduler(interval_seconds: int = 300, run_once: bool = False):
    """
    Runs the continuous scheduling loop.
    """
    logger.info("=" * 65)
    logger.info("ExamSetu — Near-Instant Job Ingestion Scheduler Started")
    logger.info(f"  Check Interval: {interval_seconds} seconds ({interval_seconds // 60} mins)")
    logger.info(f"  Mode:           {'Single Pass (--once)' if run_once else 'Continuous Daemon'}")
    logger.info("=" * 65)

    while True:
        try:
            check_and_ingest(limit=15)
        except Exception as err:
            logger.error(f"Unexpected error in scheduler loop: {err}")

        if run_once:
            logger.info("Single pass execution finished (--once mode). Exiting.")
            break

        logger.info(f"Sleeping for {interval_seconds} seconds until next check...\n")
        time.sleep(interval_seconds)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    parser = argparse.ArgumentParser(description="ExamSetu Job Ingestion Scheduler Daemon")
    parser.add_argument(
        "--interval",
        type=int,
        default=300,
        help="Check interval in seconds (default: 300 = 5 minutes)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single check pass and exit immediately",
    )

    args = parser.parse_args()
    run_scheduler(interval_seconds=args.interval, run_once=args.once)
