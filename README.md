# ExamSetu — Sarkari Job Eligibility + Doubt Assistant

A zero-cost web platform for Indian government exam aspirants. Automatically tracks official exam notifications (UPSSSC, UP Police, SSC CGL), checks eligibility via deterministic rules, and answers doubts via RAG chat — all on free tiers.

> ⚠️ **AI AGENTS / DEVELOPERS NOTICE**: Please read [PROJECT_CONTEXT.md](file:///d:/sarkari/PROJECT_CONTEXT.md) and [AGENTS.md](file:///d:/sarkari/AGENTS.md) before starting any task to get full historical context and architecture decisions. Always update `PROJECT_CONTEXT.md` upon task completion.

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub Actions  │────▶│    Supabase       │◀────│ Cloudflare Pages│
│  (every 20 min)  │     │  Postgres+pgvector│     │  (Next.js SSG)  │
│                  │     │  Storage + Auth   │     │  Pages Functions│
│  scrape → OCR →  │     └──────────────────┘     └─────────────────┘
│  extract → embed │            ▲                        ▲
└─────────────────┘            │                        │
                               │              ┌─────────┴─────────┐
                    ┌──────────┴──────┐       │   User Browser    │
                    │  Telegram Bot   │       │  (eligibility     │
                    │  (webhook via   │       │   check runs      │
                    │   CF Function)  │       │   client-side)    │
                    └─────────────────┘       └───────────────────┘
```

## 🛠️ Tech Stack (All Free Tier)

| Layer | Service | Cost |
|---|---|---|
| Frontend | Cloudflare Pages (Next.js static export) | $0 |
| Database | Supabase Postgres + pgvector | $0 |
| File Storage | Supabase Storage | $0 |
| Auth | Supabase Auth | $0 |
| Automation | GitHub Actions (public repo) | $0 |
| LLM (extraction) | Cerebras (Llama 3.1 70B) | $0 |
| LLM (chat) | Groq (Llama 3.3 70B) | $0 |
| LLM (fallback) | Mistral (free tier) | $0 |
| Embeddings | Gemini Embedding API (AI Studio) | $0 |
| Notifications | Telegram Bot API | $0 |
| OCR | Tesseract (open source) | $0 |

## 📋 Prerequisites

- **Python 3.10+** installed locally
- **Node.js 18+** and npm installed locally
- **Git** installed
- **Tesseract OCR** (for local development only — CI installs it automatically)

### Install Tesseract locally (one-time, system-level step)

**Windows:**
1. Download from: https://github.com/UB-Mannheim/tesseract/wiki
2. During install, check "Additional language data" → select "Hindi"
3. Add Tesseract to your PATH

**macOS:**
```bash
brew install tesseract tesseract-lang
```

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-hin
```

## 🚀 Local Setup

### 1. Clone and setup Python environment

```bash
git clone https://github.com/YOUR_USERNAME/examsetu.git
cd examsetu

# Create Python virtual environment (inside project root)
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your actual API keys (see "Account Setup" below)
```

### 3. Set up Supabase

1. Go to https://supabase.com and create a free project
2. Go to **SQL Editor** → **New query**
3. Paste the contents of `supabase/schema.sql` and run it
4. Go to **Storage** → Create a new bucket called `notification-pdfs` (set to Public)
5. Copy your project URL and keys from **Settings** → **API**:
   - `SUPABASE_URL` → Project URL
   - `SUPABASE_ANON_KEY` → `anon` `public` key
   - `SUPABASE_SERVICE_ROLE_KEY` → `service_role` key (keep secret!)

### 4. Set up LLM API keys (all free, no credit card)

**Groq (for RAG chat):**
1. Go to https://console.groq.com
2. Sign up (no credit card)
3. Go to **API Keys** → Create new key
4. Copy to `GROQ_API_KEY` in `.env`

**Cerebras (for extraction):**
1. Go to https://cloud.cerebras.ai
2. Sign up (no credit card)
3. Generate an API key
4. Copy to `CEREBRAS_API_KEY` in `.env`

**Mistral (fallback):**
1. Go to https://console.mistral.ai
2. Sign up and choose **Free** mode
3. Generate an API key
4. Copy to `MISTRAL_API_KEY` in `.env`

**Gemini (embeddings only):**
1. Go to https://aistudio.google.com ⚠️ **Use AI Studio, NOT Google Cloud Console**
2. Sign in with Google account (no credit card, no billing project)
3. Click **Get API Key** → Create key
4. Copy to `GEMINI_API_KEY` in `.env`

> ⚠️ **Important**: Create your Gemini key via AI Studio without enabling billing. This makes it physically impossible to get charged.

### 5. Set up the Next.js frontend

```bash
cd web
npm install
npm run dev    # Starts dev server at http://localhost:3000
```

### 6. Test the pipeline manually

```bash
# Make sure venv is activated
cd <project-root>
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Run the full pipeline
python -m automation.run_pipeline

# Or test individual modules:
python -m automation.scrape          # Just scrape, don't download
python -m automation.ocr_extract path/to/test.pdf  # Test OCR on a PDF
```

## 🤖 Telegram Bot Setup

### Step 1: Create the bot

1. Open Telegram and search for **@BotFather** (verify it has the blue checkmark ✓)
2. Send `/start`
3. Send `/newbot`
4. Enter display name: `ExamSetu Alerts`
5. Enter username (must end with `bot`): `examsetu_bot`
6. **Save the API token** BotFather gives you (looks like `7123456789:AAHdqT...xyz`)

### Step 2: Configure the bot

Send these commands to @BotFather:
```
/setdescription
Get instant alerts for govt exam notifications. Check eligibility & ask doubts.

/setabouttext
ExamSetu - Your Sarkari Exam Assistant 🎓

/setcommands
start - Start the bot and see welcome message
register - Register your profile for alerts
check - Check eligibility for an exam
help - Show help and available commands
```

### Step 3: Get your admin chat ID

1. Send any message to your new bot
2. Open in browser: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Find `"chat":{"id": 123456789}` — that's your admin chat ID
4. Add both to `.env`:
   ```
   TELEGRAM_BOT_TOKEN=7123456789:AAHdqT...xyz
   TELEGRAM_ADMIN_CHAT_ID=123456789
   ```

### Step 4: Set webhook (after deploying to Cloudflare)

```bash
# Set the webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://examsetu.pages.dev/api/telegram/webhook"}'

# Verify it's set correctly
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## ☁️ Deployment

### Cloudflare Pages

1. Push your repo to GitHub (must be **public** for free Actions minutes)
2. Go to https://dash.cloudflare.com → Pages → Create a project
3. Connect your GitHub repository
4. Build settings:
   - **Framework preset**: None
   - **Build command**: `cd web && npm run build`
   - **Build output directory**: `web/out`
   - **Root directory**: `/`
5. Add environment variables in Cloudflare Pages settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GROQ_API_KEY`
   - `GEMINI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
6. Deploy!

### GitHub Actions Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `CEREBRAS_API_KEY`
- `MISTRAL_API_KEY`
- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `CF_DEPLOY_HOOK_URL` (get from Cloudflare Pages → Deploy hooks)

## 📁 Project Structure

```
examsetu/
├── .github/workflows/         # CI/CD
│   ├── scrape-and-ingest.yml  # Scheduled scraper (every 20 min)
│   └── keepalive.yml          # Supabase ping (every 3 days)
├── automation/                # Python pipeline
│   ├── config.py              # Shared config & Supabase client
│   ├── llm_client.py          # Multi-provider LLM with failover
│   ├── scrape.py              # Web scraper for .gov.in sites
│   ├── download.py            # PDF download + hash + storage
│   ├── ocr_extract.py         # PyMuPDF + Tesseract OCR
│   ├── rule_extraction.py     # LLM → structured eligibility rules
│   ├── diff_corrigendum.py    # Version diff + change summary
│   ├── embed_and_store.py     # Text chunking + Gemini embeddings
│   ├── notify_telegram.py     # Alert matching users
│   └── run_pipeline.py        # Orchestrator
├── data_sources/
│   └── sources.yaml           # Official notification URLs
├── supabase/
│   └── schema.sql             # Full database schema
├── web/                       # Next.js frontend
├── .env.example               # Environment variable template
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## ⚖️ License

MIT

## ⚠️ Disclaimer

ExamSetu is an unofficial tool. Always verify eligibility against the original official notification before applying. The creators are not responsible for any decisions made based on this tool's output.
