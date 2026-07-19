import sys
import ssl
import fitz  # PyMuPDF
import urllib.request
from pathlib import Path
from automation.config import get_supabase

sys.stdout.reconfigure(encoding="utf-8")

def main():
    supabase = get_supabase()
    res = supabase.from_("notifications").select("*").ilike("title", "%NFR%").execute()
    if not res.data:
        print("NFR not found")
        return
    n = res.data[0]
    print("Notification:", n["title"])
    print("PDF URL:", n["pdf_url"])

    pdf_url = n["pdf_url"]
    temp_pdf = Path("automation/downloads/temp_nfr.pdf")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(pdf_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, context=ctx) as resp, open(temp_pdf, "wb") as f:
        f.write(resp.read())

    doc = fitz.open(temp_pdf)
    print("Total pages:", len(doc))

    for i in range(min(3, len(doc))):
        text = doc[i].get_text()
        print(f"=== PAGE {i+1} ===")
        print(text[:1500])

if __name__ == "__main__":
    main()
