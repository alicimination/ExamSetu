import re
import sys
import requests
from bs4 import BeautifulSoup
from automation.config import get_supabase, USER_AGENT, REQUEST_TIMEOUT

sys.stdout.reconfigure(encoding="utf-8")

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

def parse_dates_from_html(html: str) -> tuple[str | None, str | None]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text()

    # Search for patterns like "Last Date for Apply Online : 19/08/2026" or "19-08-2026" or "Last Date : 25/07/2026"
    start_date = None
    end_date = None

    # Match Start Date / Application Begin
    start_match = re.search(r"(?:Application Begin|Start Date|Opening Date)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", text, re.I)
    if start_match:
        raw_start = start_match.group(1).replace(".", "/").replace("-", "/")
        parts = raw_start.split("/")
        if len(parts) == 3:
            day, month, year = parts[0], parts[1], parts[2]
            if len(year) == 2: year = "20" + year
            start_date = f"{year.zfill(4)}-{month.zfill(2)}-{day.zfill(2)}"

    # Match End Date / Last Date
    end_match = re.search(r"(?:Last Date|Closing Date|Apply Online Last Date)\s*(?:for\s*Apply|to\s*Apply)?\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", text, re.I)
    if end_match:
        raw_end = end_match.group(1).replace(".", "/").replace("-", "/")
        parts = raw_end.split("/")
        if len(parts) == 3:
            day, month, year = parts[0], parts[1], parts[2]
            if len(year) == 2: year = "20" + year
            end_date = f"{year.zfill(4)}-{month.zfill(2)}-{day.zfill(2)}"

    return start_date, end_date

def main():
    supabase = get_supabase()
    res = supabase.from_("notifications").select("id, title, source_url, apply_start_date, apply_end_date").execute()
    notifications = res.data
    print(f"Loaded {len(notifications)} notifications from Supabase.")

    updated_count = 0

    for n in notifications:
        n_id = n["id"]
        title = n["title"]
        source_url = n.get("source_url")

        if n.get("apply_end_date"):
            print(f"✓ Already has date: [{title[:40]}] -> End: {n['apply_end_date']}")
            continue

        if not source_url:
            continue

        try:
            print(f"Fetching source page for: {title[:40]}...")
            resp = requests.get(source_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                s_date, e_date = parse_dates_from_html(resp.text)
                if s_date or e_date:
                    update_payload = {}
                    if s_date: update_payload["apply_start_date"] = s_date
                    if e_date: update_payload["apply_end_date"] = e_date

                    supabase.from_("notifications").update(update_payload).eq("id", n_id).execute()
                    updated_count += 1
                    print(f"  --> UPDATED! Start: {s_date}, End: {e_date}")
                else:
                    print("  --> No date match in HTML")
        except Exception as e:
            print(f"  --> Error fetching {source_url}: {e}")

    print(f"\nCompleted! Total notifications updated with extracted dates: {updated_count}")

if __name__ == "__main__":
    main()
