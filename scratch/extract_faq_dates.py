import re
import sys
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from automation.config import get_supabase, USER_AGENT, REQUEST_TIMEOUT

sys.stdout.reconfigure(encoding="utf-8")

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

MONTHS_MAP = {
    "january": "01", "february": "02", "march": "03", "april": "04",
    "may": "05", "june": "06", "july": "07", "august": "08",
    "september": "09", "october": "10", "november": "11", "december": "12",
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "jun": "06",
    "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"
}

def parse_text_date(date_str: str) -> str | None:
    date_str = date_str.strip()
    # Try DD Month YYYY e.g., "26 July 2026" or "01 July 2026"
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", date_str)
    if m:
        day = m.group(1).zfill(2)
        month_name = m.group(2).lower()
        year = m.group(3)
        month = MONTHS_MAP.get(month_name)
        if month:
            return f"{year}-{month}-{day}"

    # Try DD/MM/YYYY or DD-MM-YYYY
    m = re.search(r"(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})", date_str)
    if m:
        day = m.group(1).zfill(2)
        month = m.group(2).zfill(2)
        year = m.group(3)
        return f"{year}-{month}-{day}"

    return None

def extract_dates_from_page(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    start_date = None
    end_date = None

    text = soup.get_text()

    # Search for "last date for online application ... is 26 July 2026"
    end_match = re.search(r"last date for online application[^\.]*?(?:is|before)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})", text, re.I)
    if end_match:
        end_date = parse_text_date(end_match.group(1))

    start_match = re.search(r"(?:started on|application[^\.]*?start[^\.]*?on)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})", text, re.I)
    if start_match:
        start_date = parse_text_date(start_match.group(1))

    return start_date, end_date

def main():
    supabase = get_supabase()
    res = supabase.from_("notifications").select("id, title, source_url, apply_start_date, apply_end_date").execute()
    notifications = res.data
    print(f"Checking FAQ dates for {len(notifications)} notifications...")

    updated = 0
    for n in notifications:
        n_id = n["id"]
        title = n["title"]
        source_url = n.get("source_url")

        if n.get("apply_end_date"):
            print(f"✓ Already set: [{title[:35]}] -> End: {n['apply_end_date']}")
            continue

        if not source_url or "sarkariresult" not in source_url:
            continue

        try:
            r = requests.get(source_url, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                s_date, e_date = extract_dates_from_page(soup)
                if s_date or e_date:
                    payload = {}
                    if s_date: payload["apply_start_date"] = s_date
                    if e_date: payload["apply_end_date"] = e_date
                    supabase.from_("notifications").update(payload).eq("id", n_id).execute()
                    updated += 1
                    print(f"✅ UPDATED [{title[:35]}] -> Start: {s_date}, End: {e_date}")
                else:
                    print(f"❌ No FAQ date match for: [{title[:35]}]")
        except Exception as err:
            print(f"Error for {title[:30]}: {err}")

    print(f"\nDone! Extracted & updated dates for {updated} notifications.")

if __name__ == "__main__":
    main()
