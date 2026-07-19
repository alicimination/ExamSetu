-- ExamSetu — Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ============================================================
-- 1. Enable required extensions
-- ============================================================
create extension if not exists vector;

-- ============================================================
-- 2. Core tables
-- ============================================================

-- Tracked exam notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  exam_body text not null,            -- e.g. 'upsssc', 'ssc', 'uppbpb'
  title text not null,                -- Notification title
  source_url text not null,           -- Page where the PDF link was found
  pdf_url text not null,              -- Direct URL to the PDF
  pdf_storage_path text,              -- Path in Supabase Storage bucket
  pdf_hash text not null,             -- SHA-256 hash for change detection
  status text not null default 'new', -- new | pending_review | verified
  vacancy_count int,                  -- Total vacancies (if extractable)
  apply_start_date date,              -- Application start date
  apply_end_date date,                -- Application end date
  exam_date date,                     -- Exam date (if announced)
  notice_type text not null default 'recruitment', -- recruitment | update
  parent_id uuid references notifications(id) on delete set null, -- parent recruitment notification if update
  first_seen_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Version tracking for corrigenda / updates
create table if not exists notification_versions (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references notifications(id) on delete cascade,
  version_no int not null,
  pdf_hash text not null,
  pdf_url text,
  diff_summary text,                  -- Plain-language summary of changes
  detected_at timestamptz default now()
);

-- Extracted eligibility rules (LLM-extracted, needs human review)
create table if not exists eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references notifications(id) on delete cascade,
  post_name text not null,
  min_age int,
  max_age int,
  category_relaxations jsonb default '{}',  -- {"OBC": 3, "SC": 5, "ST": 5, "EWS": 0}
  gender_relaxations jsonb default '{}',    -- {"female": 5} (age relaxation in years)
  education_requirement text,
  domicile_requirement text,
  additional_requirements text,             -- Any other requirements (physical, experience)
  fee_general int,                          -- Application fee in INR
  fee_reserved int,                         -- Fee for SC/ST/PwD
  source_page_ref text,                     -- Page/section reference in PDF
  extraction_confidence float,
  status text not null default 'pending_review', -- pending_review | verified | rejected
  reviewed_by text,
  notified boolean default false,           -- Whether Telegram alerts have been sent
  extracted_at timestamptz default now()
);

-- Document chunks for RAG (with pgvector embeddings)
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references notifications(id) on delete cascade,
  chunk_text text not null,
  chunk_index int not null,                 -- Order within the document
  page_ref int,                             -- Source page number
  embedding vector(768),                    -- Gemini embedding (768-dim via MRL)
  created_at timestamptz default now()
);

-- Telegram user profiles for alert matching
create table if not exists user_profiles (
  telegram_id bigint primary key,
  telegram_username text,
  dob date,
  category text,                            -- General | OBC | SC | ST | EWS
  education text,                           -- 10th | 12th | Graduation | Post-Graduation
  state text,                               -- e.g. 'Uttar Pradesh'
  gender text,                              -- male | female | other
  opted_in_alerts boolean default true,
  is_premium boolean default false,         -- Future monetization hook
  registration_state jsonb default '{}',    -- Tracks multi-step registration progress
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Change detection: tracks which PDFs we've already seen
create table if not exists seen_documents (
  pdf_url text primary key,
  pdf_hash text not null,
  notification_id uuid references notifications(id) on delete set null,
  last_checked_at timestamptz default now()
);

-- RAG response cache (to reduce LLM calls)
create table if not exists chat_cache (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null,
  question_hash text not null,              -- SHA-256 of normalized question
  answer text not null,
  citations jsonb default '[]',
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '1 hour'),
  unique(notification_id, question_hash)
);

-- LLM usage tracking
create table if not exists llm_usage_log (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                   -- groq | cerebras | mistral | gemini
  model text not null,
  purpose text not null,                    -- extraction | chat | embedding | diff
  tokens_in int,
  tokens_out int,
  latency_ms int,
  success boolean default true,
  error_message text,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. Indexes
-- ============================================================

-- Vector similarity search index for RAG
create index if not exists idx_document_chunks_embedding
  on document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Fast lookups
create index if not exists idx_notifications_exam_body on notifications(exam_body);
create index if not exists idx_notifications_status on notifications(status);
create index if not exists idx_eligibility_rules_notification on eligibility_rules(notification_id);
create index if not exists idx_eligibility_rules_status on eligibility_rules(status);
create index if not exists idx_document_chunks_notification on document_chunks(notification_id);
create index if not exists idx_chat_cache_lookup on chat_cache(notification_id, question_hash);
create index if not exists idx_chat_cache_expiry on chat_cache(expires_at);
create index if not exists idx_llm_usage_created on llm_usage_log(created_at);

-- ============================================================
-- 4. Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
alter table notifications enable row level security;
alter table notification_versions enable row level security;
alter table eligibility_rules enable row level security;
alter table document_chunks enable row level security;
alter table user_profiles enable row level security;
alter table seen_documents enable row level security;
alter table chat_cache enable row level security;
alter table llm_usage_log enable row level security;

-- Public read access for frontend (anon key)
create policy "Public read notifications"
  on notifications for select using (true);

create policy "Public read notification_versions"
  on notification_versions for select using (true);

create policy "Public read verified eligibility rules"
  on eligibility_rules for select using (true);

create policy "Public read document chunks"
  on document_chunks for select using (true);

create policy "Public read chat cache"
  on chat_cache for select using (true);

-- Service role has full access (used by automation scripts)
-- Note: service_role key bypasses RLS by default in Supabase,
-- so no explicit policies needed for automation write operations.

-- ============================================================
-- 5. Storage bucket
-- ============================================================
-- Create this manually in Supabase Dashboard → Storage → New bucket:
--   Name: notification-pdfs
--   Public: true (so users can download original PDFs)
--   File size limit: 50MB
