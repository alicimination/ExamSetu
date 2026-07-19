# ExamSetu — Authoritative Project Context & Development Log

⚠️ **AI AGENTS NOTICE**: You **MUST** read this file completely (`PROJECT_CONTEXT.md`) at the start of every session before touching any code. You **MUST** update this file (`PROJECT_CONTEXT.md`) at the end of every completed task or feature with the latest progress, changes, and decisions.

---

## 📌 Project Overview & Core Philosophy
**ExamSetu** is a zero-cost, modern web platform & automated notification tracking pipeline for Indian government exam aspirants (UPSSSC, UP Police, SSC CGL, etc.).
- **Core Mission**: Provide instant, deterministic eligibility checking against extracted government rules, structured notification tracking, and RAG-powered doubt resolution (`/chat/`) completely on free tiers.
- **Design Philosophy**: Vibrant, clean, high-precision UI aesthetics matching modern government aspirant portals with crisp card layouts, dark stats banners, side-by-side physical standards tables, responsive mobile controls, and a full-featured AI Mentor chat interface.

---

## 🏗️ System Architecture & Key Components

### 1. Frontend (`web/` — Next.js 16.2.10, Vanilla CSS)
- **Styling (`app/globals.css`)**: 
  - Custom design system built with CSS variables (`--bg-body`, `--bg-dark`, `--primary: #2563EB`, `--text-primary`, `--status-verified-bg`, `--status-eligible-bg`).
- **Navbar & Footer (`app/layout.tsx`)**:
  - Header Navbar links: `Exams`, `Notifications`, `FAQs`, `Telegram Bot`.
  - Modern Dark Footer (`.footer-dark`) with 3 clean columns: Brand description, Company links (`/privacy`, `/terms`, `/disclaimer`), and Support links (`/faq`, `/sources`, Telegram alerts).
- **Main Landing Page (`app/page.tsx`)**:
  - **Dynamic Pagination**: Initial view loads 12 cards. The button dynamically states the exact count of remaining jobs (`Load X More Jobs →`) and loads 12 more per click.
  - **Whole Job Card Clickable**: Clicking anywhere on a `.job-card` navigates to `/details/?id=...`.
- **Notification Details Page (`app/details/page.tsx`)**:
  - Header with top action button (`[📄 View Official PDF / Apply Now]`).
  - **AI Infodesk Card**: Sidebar card header updated to "AI Infodesk".
- **AI Mentor Chat Page (`app/chat/page.tsx`)**:
  - **Internal Container Auto-Scroll & Focus**: Internal `.chat-messages-area` container scrolling (`chatContainerRef.current.scrollTo(...)`) and automatic input focus.

### 2. Backend & Automation (`automation/` — Python 3.10+)
- **Database (`supabase/schema.sql`)**: Supabase Postgres + `pgvector` (`embeddings` table with `vector(768)`).
- **Scraper & Downloader (`scrape.py`, `download.py`, `scrape_sarkariresult.py`)**: Fetches official `.gov.in` notices and SarkariResult posts, extracts dates (`apply_start_date`, `apply_end_date`), hashes PDFs (`sha256`), stores public URLs in Supabase bucket `notification-pdfs`.
- **High-Frequency Ingestion Scheduler (`automation/scheduler.py`)**:
  - Fast deduplication check daemon running every 5 minutes (`--interval 300`) or single pass (`--once`).
- **GitHub Actions Workflow (`.github/workflows/ingest_cron.yml`)**:
  - Automated cron schedule running every 15 minutes (`*/15 * * * *`) and on manual trigger (`workflow_dispatch`).

---

## 📜 Chronological Development Log & Changes

### [2026-07-23] — Local Dev Server Application Terminated
- **Stopped**: Stopped local Next.js background dev server process (`task-194`).
- **Files Modified**: `PROJECT_CONTEXT.md`.

---

## 🧪 Verified Testing Status
- ✅ Local Next.js dev server successfully shut down.
- ✅ TypeScript compilation passed cleanly (`Finished TypeScript in 3.2s`).

---

## 🚀 Next Steps & Future Roadmap
1. **Telegram Webhook Testing**: Verify live `/api/telegram/webhook` response to Telegram commands (`/check`, `/register`) from `@examsetu_bot`.
2. **Mobile Nav Drawer**: Add mobile hamburger toggle menu for header links on small mobile screens (<640px).
