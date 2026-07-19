"""
ExamSetu — Download portable Tesseract OCR into the project.
Downloads the UB-Mannheim Tesseract installer, extracts it silently
into .tools/tesseract/ within the project. Also downloads Hindi
language data for OCR on government notifications.

Everything stays inside the project directory. No system-wide install.
Completely free and open-source (Apache 2.0 license).
"""

import os
import sys
import subprocess
import urllib.request
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TOOLS_DIR = PROJECT_ROOT / ".tools"
TESSERACT_DIR = TOOLS_DIR / "tesseract"
TESSDATA_DIR = TESSERACT_DIR / "tessdata"

# UB-Mannheim Tesseract 5.5.0 (latest stable)
# Using GitHub releases URL (the digi.bib.uni-mannheim.de mirror may block automated downloads)
TESSERACT_INSTALLER_URL = (
    "https://github.com/tesseract-ocr/tesseract/releases/download/5.5.0/"
    "tesseract-ocr-w64-setup-5.5.0.20241111.exe"
)

# Hindi traineddata from tessdata_best (higher accuracy for Hindi government docs)
HINDI_TRAINEDDATA_URL = (
    "https://github.com/tesseract-ocr/tessdata_best/raw/main/hin.traineddata"
)


import ssl
import urllib3
import requests

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def download_file(url: str, dest: Path, label: str = ""):
    """Download a file with progress indication using requests (SSL verification disabled)."""
    print(f"  Downloading {label or url}...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://github.com/UB-Mannheim/tesseract/wiki",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Upgrade-Insecure-Requests": "1"
    }
    try:
        response = requests.get(url, headers=headers, stream=True, verify=False, timeout=120)
        response.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        size_mb = dest.stat().st_size / (1024 * 1024)
        print(f"  Done ({size_mb:.1f} MB)")
    except Exception as e:
        print(f"  ERROR: Download failed: {e}")
        raise


def setup_tesseract():
    """Download and set up portable Tesseract OCR."""
    print("=" * 60)
    print("ExamSetu — Tesseract OCR Setup (portable, project-local)")
    print("=" * 60)

    # Check if already set up
    tesseract_exe = TESSERACT_DIR / "tesseract.exe"
    if tesseract_exe.exists():
        print(f"\nTesseract already installed at: {tesseract_exe}")
        # Check for Hindi data
        hindi_data = TESSDATA_DIR / "hin.traineddata"
        if hindi_data.exists():
            print(f"Hindi language data found: {hindi_data}")
            print("Setup already complete!")
            return
        else:
            print("Hindi language data missing, downloading...")

    TOOLS_DIR.mkdir(parents=True, exist_ok=True)

    if not tesseract_exe.exists():
        print(f"\nStep 1: Downloading Tesseract installer...")
        installer_path = TOOLS_DIR / "tesseract_installer.exe"
        download_file(TESSERACT_INSTALLER_URL, installer_path, "Tesseract 5.5.0")

        print(f"\nStep 2: Extracting to {TESSERACT_DIR}...")
        TESSERACT_DIR.mkdir(parents=True, exist_ok=True)

        # Run the NSIS installer in silent mode, extracting to our directory
        try:
            subprocess.run(
                [
                    str(installer_path),
                    "/S",  # Silent mode
                    f"/D={TESSERACT_DIR}",  # Target directory
                ],
                check=True,
                timeout=120,
            )
            print("  Extraction complete!")
        except subprocess.TimeoutExpired:
            print("  Installer timed out, but files may have been extracted.")
        except Exception as e:
            print(f"  Installer failed: {e}")
            print("  Trying alternative extraction...")
            # Alternative: use 7z if available
            try:
                subprocess.run(
                    ["7z", "x", str(installer_path), f"-o{TESSERACT_DIR}", "-y"],
                    check=True, timeout=60,
                )
                print("  7z extraction complete!")
            except Exception:
                print("  ERROR: Could not extract Tesseract.")
                print("  Please manually install Tesseract from:")
                print(f"  {TESSERACT_INSTALLER_URL}")
                print(f"  And extract to: {TESSERACT_DIR}")
                sys.exit(1)

        # Clean up installer
        try:
            installer_path.unlink()
        except Exception:
            pass

    # Step 3: Download Hindi language data
    TESSDATA_DIR.mkdir(parents=True, exist_ok=True)
    hindi_data = TESSDATA_DIR / "hin.traineddata"

    if not hindi_data.exists():
        print(f"\nStep 3: Downloading Hindi language data...")
        download_file(HINDI_TRAINEDDATA_URL, hindi_data, "Hindi traineddata")

    # Verify installation
    tesseract_exe = TESSERACT_DIR / "tesseract.exe"
    if tesseract_exe.exists():
        print(f"\n{'=' * 60}")
        print("Setup complete!")
        print(f"  Tesseract: {tesseract_exe}")
        print(f"  Tessdata:  {TESSDATA_DIR}")
        print(f"{'=' * 60}")
    else:
        print("\nWARNING: tesseract.exe not found after setup.")
        print("The installer may still be running in the background.")
        print(f"Check {TESSERACT_DIR} in a moment.")


if __name__ == "__main__":
    setup_tesseract()
