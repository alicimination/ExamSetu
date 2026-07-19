"""
ExamSetu — Dedicated scraper for sarkariresult.com.cm job notifications.
Extracts job metadata, official .gov.in PDF links (if available), and page HTML summary text.
"""

import re
import logging
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

from automation.config import USER_AGENT, REQUEST_TIMEOUT

logger = logging.getLogger("examsetu.scrape_sarkariresult")

BASE_URL = "https://sarkariresult.com.cm/"
LATEST_JOBS_URL = "https://sarkariresult.com.cm/latest-jobs/"

EXCLUDED_PATHS = {
    "/", "/latest-jobs/", "/admit-card/", "/result/", "/admission/",
    "/syllabus/", "/answer-key/", "/contact/", "/privacy-policy/", "/disclaimer/", "/latest-posts/"
}


def _get_headers() -> dict:
    return {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    }


def fetch_latest_job_urls(limit: int = 100) -> list[dict]:
    """
    Fetch active job post URLs from SarkariResult Latest Jobs section.
    Returns list of {"title": str, "url": str}
    """
    logger.info(f"Fetching latest jobs from {LATEST_JOBS_URL}")
    res = requests.get(LATEST_JOBS_URL, headers=_get_headers(), timeout=REQUEST_TIMEOUT)
    res.raise_for_status()

    soup = BeautifulSoup(res.text, "html.parser")
    job_links = []
    seen = set()

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        title = a.get_text(strip=True)
        if not href or not title or href in seen:
            continue

        parsed = urlparse(href)
        path = parsed.path.lower()

        if path in EXCLUDED_PATHS or path.startswith("/category/") or path.startswith("/page/") or path.startswith("/author/"):
            continue

        # Valid job post slug format (usually contains numbers/year or specific job keywords)
        if ("sarkariresult.com.cm" in parsed.netloc or href.startswith("/")) and len(title) > 8:
            absolute_url = urljoin(BASE_URL, href)
            seen.add(href)
            job_links.append({"title": title, "url": absolute_url})

    logger.info(f"Discovered {len(job_links)} job post URLs (limiting to top {limit})")
    return job_links[:limit]


def parse_job_detail_page(job_info: dict) -> dict:
    """
    Parse a single job post page on SarkariResult.
    Extracts title, exam_body, official PDF link, vacancy count, dates, and clean full text.
    """
    url = job_info["url"]
    title = job_info["title"]
    logger.info(f"Parsing detail page: {url}")

    res = requests.get(url, headers=_get_headers(), timeout=REQUEST_TIMEOUT)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    # Determine exam body from title
    title_upper = title.upper()
    exam_body = "other"
    for body in ["UPSSSC", "UP Police", "UPPRPB", "UPPSC", "SSC", "RRB", "BPSC", "IBPS", "RSSB", "RPSC", "MPESB", "JSSC", "ONGC", "NEET", "UPSC", "DCB"]:
        if body.upper() in title_upper:
            exam_body = body.lower().replace(" ", "")
            break

    # Look for official PDF links & official website links
    official_pdf_url = None
    official_site_url = None

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        link_text = a.get_text(strip=True).lower()

        if (href.lower().endswith(".pdf") or "notification" in link_text or "pdf" in link_text) and not official_pdf_url:
            if href.startswith("http"):
                official_pdf_url = href
        if any(gov in href.lower() for gov in [".gov.in", ".nic.in", ".org.in"]) and not official_site_url:
            official_site_url = href

    # Extract vacancy count using regex from title/content
    vacancy_match = re.search(r"\((\d+)\+?\s*Posts?\)", title, re.IGNORECASE)
    vacancy_count = int(vacancy_match.group(1)) if vacancy_match else None

    # Clean text content from entry-content / article body
    article = soup.find("article") or soup.find("div", class_=re.compile(r"content|entry|post"))
    if article:
        for tag in article.find_all(["script", "style", "iframe", "ins", "button"]):
            tag.decompose()
        clean_text = article.get_text(separator="\n", strip=True)
    else:
        clean_text = soup.get_text(separator="\n", strip=True)

    # Extract dates using regex from text
    apply_start_date = None
    apply_end_date = None

    start_match = re.search(r"(?:Application Begin|Start Date|Opening Date)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", clean_text, re.I)
    if start_match:
        raw_start = start_match.group(1).replace(".", "/").replace("-", "/")
        parts = raw_start.split("/")
        if len(parts) == 3:
            d, m, y = parts[0], parts[1], parts[2]
            if len(y) == 2: y = "20" + y
            apply_start_date = f"{y.zfill(4)}-{m.zfill(2)}-{d.zfill(2)}"

    end_match = re.search(r"(?:Last Date|Closing Date|Apply Online Last Date)\s*(?:for\s*Apply|to\s*Apply)?\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", clean_text, re.I)
    if end_match:
        raw_end = end_match.group(1).replace(".", "/").replace("-", "/")
        parts = raw_end.split("/")
        if len(parts) == 3:
            d, m, y = parts[0], parts[1], parts[2]
            if len(y) == 2: y = "20" + y
            apply_end_date = f"{y.zfill(4)}-{m.zfill(2)}-{d.zfill(2)}"

    return {
        "title": title,
        "source_url": url,
        "exam_body": exam_body,
        "pdf_url": official_pdf_url or url,
        "official_site_url": official_site_url,
        "vacancy_count": vacancy_count,
        "apply_start_date": apply_start_date,
        "apply_end_date": apply_end_date,
        "full_text": clean_text,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    jobs = fetch_latest_job_urls(limit=3)
    for j in jobs:
        detail = parse_job_detail_page(j)
        print(f"\nTitle: {detail['title']}")
        print(f"Exam Body: {detail['exam_body']}")
        print(f"PDF URL: {detail['pdf_url']}")
        print(f"Text Chars: {len(detail['full_text'])}")
