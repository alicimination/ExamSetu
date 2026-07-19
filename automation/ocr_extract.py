"""
ExamSetu — OCR and text extraction from notification PDFs.
Uses PyMuPDF for text-based PDFs, falls back to Tesseract OCR for image/scanned PDFs.
Tesseract binary is auto-detected from the project-local .tools/tesseract/ directory,
or falls back to system PATH.
"""

import logging
import os
from pathlib import Path

import fitz  # PyMuPDF

logger = logging.getLogger("examsetu.ocr")

# Minimum text length per page to consider it "text-based" (not scanned)
MIN_TEXT_THRESHOLD = 100

# ── Auto-configure project-local Tesseract ────────────────────
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_TESSERACT_EXE = _PROJECT_ROOT / ".tools" / "tesseract" / "tesseract.exe"
_TESSDATA_DIR = _PROJECT_ROOT / ".tools" / "tesseract" / "tessdata"

if _TESSERACT_EXE.exists():
    try:
        import pytesseract
        pytesseract.pytesseract.tesseract_cmd = str(_TESSERACT_EXE)
        if _TESSDATA_DIR.exists():
            os.environ["TESSDATA_PREFIX"] = str(_TESSDATA_DIR)
        logger.info(f"Using project-local Tesseract: {_TESSERACT_EXE}")
    except ImportError:
        pass


def extract_text_pymupdf(pdf_path: Path) -> dict:
    """
    Try direct text extraction with PyMuPDF.
    Returns {"full_text": str, "pages": [{"page_no": int, "text": str}], "method": str}
    """
    doc = fitz.open(str(pdf_path))
    pages = []
    full_text_parts = []
    is_text_pdf = True

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text").strip()
        pages.append({
            "page_no": page_num + 1,
            "text": text,
        })
        full_text_parts.append(text)

        # If any page has very little text, it might be a scanned page
        if len(text) < MIN_TEXT_THRESHOLD:
            is_text_pdf = False

    doc.close()

    full_text = "\n\n".join(full_text_parts)

    return {
        "full_text": full_text,
        "pages": pages,
        "method": "pymupdf",
        "is_text_pdf": is_text_pdf,
        "total_pages": len(pages),
    }


def extract_text_ocr(pdf_path: Path) -> dict:
    """
    OCR extraction using Tesseract for scanned/image PDFs.
    Uses PyMuPDF's built-in rendering (no Poppler needed) to convert
    pages to images, then pytesseract for OCR.
    Language: Hindi + English (hin+eng).
    """
    try:
        import pytesseract
        from PIL import Image
        import io
    except ImportError as e:
        logger.error(
            f"OCR dependencies not available: {e}. "
            "Install pytesseract and Pillow, and ensure Tesseract binary is installed."
        )
        raise

    logger.info(f"Running OCR on {pdf_path.name} (Hindi+English)...")

    doc = fitz.open(str(pdf_path))
    pages = []
    full_text_parts = []

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)

        # Render page to image at 300 DPI using PyMuPDF (no Poppler needed)
        # Default resolution is 72 DPI, so matrix scale = 300/72 ≈ 4.17
        zoom = 300 / 72
        matrix = fitz.Matrix(zoom, zoom)
        pixmap = page.get_pixmap(matrix=matrix)

        # Convert PyMuPDF pixmap to PIL Image for Tesseract
        img_data = pixmap.tobytes("png")
        image = Image.open(io.BytesIO(img_data))

        try:
            # OCR with Hindi + English
            text = pytesseract.image_to_string(image, lang="hin+eng")
            text = text.strip()
        except Exception as e:
            logger.warning(f"OCR failed for page {page_num + 1}: {e}")
            text = ""

        pages.append({
            "page_no": page_num + 1,
            "text": text,
        })
        full_text_parts.append(text)

    doc.close()
    full_text = "\n\n".join(full_text_parts)

    logger.info(f"OCR complete: {len(pages)} pages, {len(full_text)} chars total")

    return {
        "full_text": full_text,
        "pages": pages,
        "method": "tesseract_ocr",
        "is_text_pdf": False,
        "total_pages": len(pages),
    }


def extract_text(pdf_path: Path) -> dict:
    """
    Extract text from a PDF, choosing the best method automatically.

    1. Try PyMuPDF direct text extraction first (fast, accurate for text PDFs)
    2. If text is too short/empty, fall back to Tesseract OCR (for scanned PDFs)

    Returns:
        {
            "full_text": str,
            "pages": [{"page_no": int, "text": str}],
            "method": "pymupdf" | "tesseract_ocr",
            "total_pages": int,
        }
    """
    logger.info(f"Extracting text from: {pdf_path.name}")

    # Step 1: Try PyMuPDF
    pymupdf_result = extract_text_pymupdf(pdf_path)

    if pymupdf_result["is_text_pdf"] and len(pymupdf_result["full_text"]) > MIN_TEXT_THRESHOLD:
        logger.info(
            f"Text extraction successful (PyMuPDF): "
            f"{len(pymupdf_result['full_text'])} chars, {pymupdf_result['total_pages']} pages"
        )
        return pymupdf_result

    # Step 2: Text-based extraction was insufficient, try OCR
    logger.info("Text extraction insufficient, falling back to OCR...")
    try:
        ocr_result = extract_text_ocr(pdf_path)

        if len(ocr_result["full_text"]) > len(pymupdf_result["full_text"]):
            return ocr_result
        else:
            # If OCR didn't help, return the PyMuPDF result (might be a mostly empty PDF)
            logger.warning("OCR didn't improve extraction, using PyMuPDF result")
            return pymupdf_result

    except Exception as e:
        logger.warning(f"OCR failed, using PyMuPDF result: {e}")
        return pymupdf_result


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) > 1:
        result = extract_text(Path(sys.argv[1]))
        print(f"\nMethod: {result['method']}")
        print(f"Pages: {result['total_pages']}")
        print(f"Text length: {len(result['full_text'])} chars")
        print(f"\n--- First 500 chars ---\n{result['full_text'][:500]}")
