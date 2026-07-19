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

def extract_dates_from_table(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    start_date = None
    end_date = None

    # Search all li or tr elements or text nodes
    for li in soup.find_all(["li", "tr", "p"]):
        txt = li.get_text(separator=" ", strip=True)

        if not start_date:
            m = re.search(r"(?:Application Begin|Start Date|Online Start)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", txt, re.I)
            if m:
                raw = m.group(1).replace(".", "/").replace("-", "/")
                p = raw.split("/")
                if len(p) == 3:
                    y = p[2] if len(p[2]) == 4 else "20" + p[2]
                    start_date = f"{y.zfill(4)}-{p[1].zfill(2)}-{p[0].zfill(2)}"

        if not end_date:
            m = re.search(r"(?:Last Date|Closing Date)\s*(?:for\s*Apply|to\s*Apply|for\s*Registration)?\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", txt, re.I)
            if m:
                raw = m.group(1).replace(".", "/").replace("-", "/")
                p = raw.split("/")
                if len(p) == 3:
                    y = p[2] if len(p[2]) == 4 else "20" + p[2]
                    end_date = f"{y.zfill(4)}-{p[1].zfill(2)}-{p[0].zfill(2)}"

    return start_date, end_date

def main():
    supabase = get_supabase()
    res = supabase.from_("notifications").select("id, title, source_url, apply_start_date, apply_end_date").execute()
    notifications = res.data
    print(f"Checking {len(notifications)} notifications...")

    updated = 0
    for n in notifications:
        n_id = n["id"]
        title = n["title"]
        source_url = n.get("source_url")

        if n.get("apply_end_date"):
            continue

        if not source_url or "sarkariresult" not in source_url:
            continue

        try:
            r = requests.get(source_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                s_date, e_date = extract_dates_from_table(soup)
                if s_date or e_date:
                    payload = {}
                    if s_date: payload["apply_start_date"] = s_date
                    if e_date: payload["apply_end_date"] = e_date
                    supabase.from_("notifications").update(payload).eq("id", n_id).execute()
                    updated += 1
                    print(f"✅ Updated [{title[:40]}] -> Start: {s_date}, End: {e_date}")
                else:
                    print(f"❌ No dates found in: [{title[:40]}]")
        except Exception as err:
            print(f"Error for {title[:30]}: {err}")

    print(f"\nDone! Extracted & updated dates for {updated} notifications.")

if __name__ == "__main__":
    main()
