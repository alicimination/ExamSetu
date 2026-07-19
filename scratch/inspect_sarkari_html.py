import sys
import requests
from bs4 import BeautifulSoup
from automation.config import USER_AGENT

sys.stdout.reconfigure(encoding="utf-8")

def main():
    url = "https://sarkariresult.com.cm/ibps-po-mt-xvi-2026/"
    res = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=15)
    soup = BeautifulSoup(res.text, "html.parser")
    
    print("Page Title:", soup.title.string if soup.title else "No title")
    
    # Print tables or list items
    tables = soup.find_all("table")
    print(f"Found {len(tables)} tables.")
    
    for idx, table in enumerate(tables):
        print(f"\n--- TABLE {idx+1} ---")
        text = table.get_text(separator=" | ", strip=True)
        print(text[:1000])

if __name__ == "__main__":
    main()
