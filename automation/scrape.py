"""
ExamSetu — Web scraper for official government notification pages.
Only scrapes official .gov.in websites listed in sources.yaml.
"""

import ssl
import time
import logging
import urllib3
from urllib.parse import urljoin, urlparse

import requests
from requests.adapters import HTTPAdapter
import yaml
from bs4 import BeautifulSoup

from automation.config import (
    DATA_SOURCES_FILE, USER_AGENT, REQUEST_TIMEOUT, get_supabase,
)

# Suppress InsecureRequestWarning for .gov.in sites with broken certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger("examsetu.scrape")


# ── SSL workaround for legacy government servers ─────────────
# Many Indian .gov.in sites use outdated SSL configurations that
# Python 3.12+ rejects by default (unsafe legacy renegotiation).
# This adapter allows those connections while keeping other checks.
class LegacySSLAdapter(HTTPAdapter):
    """HTTPS adapter that permits legacy SSL renegotiation and relaxed cert checks."""
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.options |= ssl.OP_LEGACY_SERVER_CONNECT
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


def _get_session() -> requests.Session:
    """Create a requests session with the legacy SSL adapter."""
    session = requests.Session()
    session.mount("https://", LegacySSLAdapter())
    return session


def load_sources() -> list[dict]:
    """Load enabled data sources from sources.yaml."""
    with open(DATA_SOURCES_FILE, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    sources = [s for s in data.get("sources", []) if s.get("enabled", False)]
    logger.info(f"Loaded {len(sources)} enabled source(s)")
    return sources


def fetch_page(url: str, rate_limit: float = 2.0) -> str:
    """
    Fetch a page with respectful scraping practices.
    Returns HTML content as string.
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    }

    session = _get_session()
    try:
        response = session.get(url, headers=headers, timeout=REQUEST_TIMEOUT, verify=False)
        response.raise_for_status()
        time.sleep(rate_limit)  # Respectful rate limiting
        return response.text
    except requests.RequestException as e:
        logger.error(f"Failed to fetch {url}: {e}")
        raise


def extract_pdf_links(html: str, base_url: str) -> list[dict]:
    """
    Extract all PDF links from an HTML page.
    Returns list of {"url": absolute_url, "title": link_text}
    """
    soup = BeautifulSoup(html, "html.parser")
    pdf_links = []
    seen_urls = set()

    for link in soup.find_all("a", href=True):
        href = link["href"].strip()

        # Resolve relative URLs
        absolute_url = urljoin(base_url, href)

        # Check if it's a PDF link
        parsed = urlparse(absolute_url)
        path_lower = parsed.path.lower()

        if path_lower.endswith(".pdf") or "/upload/" in path_lower.lower():
            if absolute_url not in seen_urls:
                seen_urls.add(absolute_url)
                title = link.get_text(strip=True) or "Untitled"
                pdf_links.append({
                    "url": absolute_url,
                    "title": title,
                })

    logger.info(f"Found {len(pdf_links)} PDF link(s) on {base_url}")
    return pdf_links


def check_against_seen(pdf_links: list[dict]) -> dict:
    """
    Check discovered PDF links against the seen_documents table.
    Returns {"new": [...], "updated": [...], "unchanged": [...]}
    """
    supabase = get_supabase()
    result = {"new": [], "updated": [], "unchanged": []}

    for link_info in pdf_links:
        url = link_info["url"]

        try:
            resp = supabase.table("seen_documents").select(
                "pdf_url, pdf_hash"
            ).eq("pdf_url", url).maybe_single().execute()

            if resp is None or resp.data is None:
                # Never seen this URL before
                result["new"].append(link_info)
                logger.info(f"NEW: {url}")
            else:
                # URL exists -- we'll check the hash after downloading
                link_info["existing_hash"] = resp.data["pdf_hash"]
                result["unchanged"].append(link_info)

        except Exception as e:
            logger.warning(f"Error checking {url}: {e}")
            # Treat as new to be safe
            result["new"].append(link_info)

    logger.info(
        f"Results: {len(result['new'])} new, "
        f"{len(result['updated'])} updated, "
        f"{len(result['unchanged'])} unchanged"
    )
    return result


def scrape_source(source: dict) -> dict:
    """
    Scrape a single source for new/updated notification PDFs.

    Args:
        source: Source config dict from sources.yaml

    Returns:
        {"source_id": str, "new": [...], "updated": [...]}
    """
    source_id = source["id"]
    rate_limit = source.get("rate_limit_seconds", 2)
    all_pdf_links = []

    logger.info(f"Scraping source: {source['name']} ({source_id})")

    for page_config in source.get("notification_pages", []):
        url = page_config["url"]
        try:
            html = fetch_page(url, rate_limit=rate_limit)
            pdf_links = extract_pdf_links(html, source["base_url"])
            all_pdf_links.extend(pdf_links)
        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")
            continue

    # Deduplicate by URL
    seen = set()
    unique_links = []
    for link in all_pdf_links:
        if link["url"] not in seen:
            seen.add(link["url"])
            unique_links.append(link)

    # Check against database
    check_result = check_against_seen(unique_links)

    return {
        "source_id": source_id,
        "source_name": source["name"],
        "new": check_result["new"],
        "updated": check_result["updated"],
    }


def scrape_all_sources() -> list[dict]:
    """
    Scrape all enabled sources.
    Returns list of results per source.
    """
    sources = load_sources()
    results = []

    for source in sources:
        try:
            result = scrape_source(source)
            results.append(result)
        except Exception as e:
            logger.error(f"Failed to scrape source {source['id']}: {e}")
            results.append({
                "source_id": source["id"],
                "source_name": source["name"],
                "new": [],
                "updated": [],
                "error": str(e),
            })

    total_new = sum(len(r["new"]) for r in results)
    total_updated = sum(len(r.get("updated", [])) for r in results)
    logger.info(f"Scraping complete: {total_new} new, {total_updated} updated across {len(results)} source(s)")

    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
    results = scrape_all_sources()
    for r in results:
        print(f"\n{r['source_name']}: {len(r['new'])} new, {len(r.get('updated', []))} updated")
        for link in r["new"]:
            print(f"  NEW: {link['title'][:60]} — {link['url']}")
