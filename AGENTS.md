# AI Agent System Instructions & Mandatory Protocol

⚠️ **MANDATORY PROTOCOL FOR ALL AI AGENTS (Antigravity, Claude, Cursor, Gemini, Copilot, etc.)** ⚠️

Before taking **ANY** action, running commands, or making edits on this repository, you **MUST** adhere strictly to the following protocol:

## 1. Mandatory First Step: Read Project Context
At the very start of every new conversation, session, or task, you **MUST** immediately read [PROJECT_CONTEXT.md](file:///d:/sarkari/PROJECT_CONTEXT.md) in full using your file viewing/reading tool.
- `PROJECT_CONTEXT.md` is the authoritative, living history of what has been built, our UI/UX design decisions, system architecture, database schema, and recent progress.
- Never ask the user what happened previously or make blind assumptions without checking `PROJECT_CONTEXT.md` first.

## 2. Mandatory Final Step: Update Project Context
At the end of every completed task, feature implementation, or bug fix, you **MUST** update [PROJECT_CONTEXT.md](file:///d:/sarkari/PROJECT_CONTEXT.md) before ending your turn:
- Append a new entry under the **Chronological Development Log & Changes** section summarizing what was added, changed, or fixed.
- Update the **Verified Testing Status** and **Next Steps & Future Roadmap** sections as appropriate.
- Ensure all architectural changes (e.g., new routes, new components, schema additions, or new environment variables) are documented under **System Architecture & Key Components**.

---

## Key Repository Guidelines
- **Frontend**: Next.js 16.2.10 inside `web/`. Use Vanilla CSS inside `web/app/globals.css`. Never introduce Tailwind CSS unless explicitly requested.
- **Backend & Automation**: Python 3.10+ inside `automation/`. Always run scripts using the active virtual environment (`.venv`).
- **Database**: Supabase Postgres (`notifications`, `eligibility_rules`, and `embeddings` tables). See `supabase/schema.sql`.
