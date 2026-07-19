# ExamSetu — Comprehensive Product & UI/UX Specification for AI UI Generators

## 1. Product Overview & Vision
**ExamSetu** is a next-generation Indian Government Exam Notification & Eligibility Intelligence Platform designed to replace cluttered, archaic government job portals (like SarkariResult) with a sleek, vibrant, high-performance, and AI-powered interface.

### Core Value Proposition
- **Automated Discovery:** Continuously scrapes government examination boards (e.g., UPSSSC, UPPBPB, SSC).
- **Automated Rule Extraction:** Converts complex 30+ page official notification PDFs into structured machine-readable eligibility rules (Age Limits, Educational Qualifications, Category Relaxations, Physical Standards, Application Fees).
- **Role-Centric Grouping:** Avoids dashboard clutter by grouping all follow-up notices (Admit Cards, DV/PST Schedules, Answer Keys, Corrigenda) under their single parent Recruitment Role Card.
- **Instant Eligibility Checking & AI Chat:** Enables job aspirants to check personalized eligibility in seconds or chat with an AI assistant grounded strictly in the official PDF text.

---

## 2. Design System & Aesthetic Brand Identity
When generating UI mockups, follow these strict visual guidelines to achieve a state-of-the-art, premium aesthetic:

### Color Palette (Dark Glassmorphism Theme)
- **Primary Background:** Deep Obsidian / Midnight Blue (`#080b16`) with ambient radial gradients (`radial-gradient(ellipse at 20% 0%, rgba(255,153,51,0.06), transparent 50%)`).
- **Surface / Cards:** Translucent Glassmorphism (`rgba(255, 255, 255, 0.04)`) with subtle borders (`rgba(255, 255, 255, 0.06)`) and backdrop blur (`backdrop-filter: blur(16px)`).
- **Indian Tricolor Signature Accent:**
  - Saffron Orange: `#ff9933` (Primary highlight, CTA buttons, active tabs)
  - Pure White: `#ffffff` (Primary text & high-contrast highlights)
  - Emerald Green: `#138808` / `#00cc66` (Verified status, eligible results, positive success states)
- **Status Colors:**
  - `Verified / Eligible`: Emerald Green (`#00cc66` / `rgba(0, 204, 102, 0.1)`)
  - `New / Fresh`: Cyan (`#00d4ff`) with pulsing dot animation
  - `Closing Soon / Ineligible`: Coral Red (`#ff4d4d`) with soft border glow
  - `Update Available`: Warm Gold / Amber (`#ffb020`)

### Typography
- **Primary Font Family:** `Inter`, `Outfit`, or `Plus Jakarta Sans`.
- **Hierarchy:** High-contrast headings (`700`/`800` weight) paired with readable, semi-translucent body copy (`#8b92a5`).

---

## 3. Comprehensive Feature & Page Breakdown

### A. Global Navigation Bar (`Sticky Glass Header`)
- **Logo & Brand Identity:** `ExamSetu` logo with tricolor gradient text and subtle badge indicator.
- **Primary Navigation Links:**
  - **Notifications / Open Roles** (`/`)
  - **Check Eligibility** (`/check`)
  - **AI Document Chat** (`/chat`)
  - **Admin Review Portal** (`/admin`)
- **User Actions:** Quick Search trigger, Telegram Alert Subscription CTA.

---

### B. Homepage / Open Job Roles Dashboard (`/`)

#### 1. Hero Banner
- Striking headline: *"Never Miss a Sarkari Exam. Instantly Know Your Eligibility."*
- Sub-header highlighting automated PDF verification and real-time alerts.

#### 2. Advanced Search & Filter Bar
- **Global Search Input:** Real-time search across post names, notification titles, exam bodies, and educational qualifications.
- **Filter Pills:**
  - **Exam Body Filter:** `All`, `UPSSSC`, `UPPBPB`, `SSC`
  - **Status Filter:** `All`, `Verified`, `Closing Soon`, `New`
  - **Minimum Education Dropdown:** `10th Pass`, `12th Pass`, `Graduation`, `Post Graduation`, `Diploma`
  - **Sort Controls:** `Latest First`, `Closing Soonest`, `Highest Vacancies`

#### 3. Role-Grouped Job Opening Card (`Notification Card`)
Each card represents a **Main Recruitment Role** (e.g., *UP Home Guard Enrollment 2025* or *UP Police Constable Recruitment 2025*).

**Card Content & Hierarchy:**
- **Top Bar:**
  - Left: Exam Body Pill Badge (`🏛️ UPPBPB`, `🏛️ UPSSSC`)
  - Right: Dynamic Status Badge (`Verified`, `New`, `3d left to apply`)
- **Primary Title:** Clean Post Name / Recruitment Role Title (e.g., *UP Home Guard Enrollment 2025*).
- **Metadata Bar:**
  - `👥 Vacancies: 42,000` (if announced)
  - `📅 Apply By: 15 Aug 2026`
  - `🕐 Found: 06 Jul 2026`
- **Key Requirements Block:**
  - Summarized Eligibility Box displaying post-level rules:
    - `🎓 Education: 10th Pass / 12th Pass`
    - `🎂 Age Limit: 18–40 yrs`
- **Embedded Update Alert Banner (Outside on Card):**
  - If follow-up notices (Admit Card, DV/PST Schedule, Answer Key, Corrigendum) exist for this role, displays a golden alert banner:
    - `⚡ New Update Available (4): Important notice regarding application form copy...`
- **Action Button Footprint:**
  - `✅ Check Eligibility` (Primary CTA gradient button)
  - `💬 Ask Doubts` (Secondary glass button)
  - `📄 Official PDF` (Ghost link button)

---

### C. Two-Column Eligibility Checker & Notice Details Page (`/check/?id=...`)

When a user clicks on any Job Card or Check Eligibility button, they enter a **side-by-side two-column desktop layout**:

#### 1. Page Header (Full Width)
- `← Back to Notifications` breadcrumb.
- Exam Body Badge + Main Role Title.

#### 2. Left Column (`1fr` Width) — Interactive Eligibility Checker
- **Caution / Verification Disclaimer Bar:** Highlights that aspirants should always cross-check with official documents.
- **User Input Form (`Enter Your Details` Card):**
  - **Date of Birth:** Interactive date picker (automatically calculates exact age against cut-off rules).
  - **Gender:** Dropdown (`Male`, `Female`, `Other`).
  - **Category:** Dropdown (`General`, `OBC`, `SC`, `ST`, `EWS`).
  - **Highest Education:** Dropdown (`10th Pass`, `12th Pass`, `Graduation`, `Post Graduation`, `Diploma`).
  - **State / Domicile:** Dropdown (`Uttar Pradesh`, `Delhi`, `Bihar`, etc.).
  - **Submit CTA:** Full-width high-contrast `🔍 Check Eligibility` button.
- **Dynamic Results Block:**
  - Renders instant evaluation cards per post inside the recruitment role.
  - **Eligible State (`✅ Eligible`):** Green accent border with success checkmark and breakdown of qualified criteria.
  - **Ineligible State (`❌ Not Eligible`):** Red accent border listing exact failing reasons (e.g., *"Candidate age 42 exceeds maximum age limit of 40 for General category"*).
  - **Source Citation:** Page reference pointing to the exact page of the official PDF where the rule was extracted.

#### 3. Right Column (`380px` Width) — Latest Updates & Notices Sidebar
- **Header:** `📢 Latest Updates & Notices (N)`
- **Chronological Updates Timeline:**
  - Lists every follow-up notice issued for this recruitment role (e.g., Admit Card releases, Application Form copy download links, Answer Key notices, DV/PST schedules).
  - Each item displays:
    - Detection Date badge (`10 Jul 2026`)
    - Notice Subject / Title
    - Direct `📄 Download Notice PDF` button

---

### D. AI Document Chat Page (`/chat/?id=...`)

#### 1. Conversational Interface
- Allows users to ask natural language questions in English or Hindi (e.g., *"Is there any physical height relaxation for ST candidates?"*, *"What is the syllabus for the written exam?"*).
- **Strict Grounding:** Assistant answers exclusively from chunks stored in `document_chunks` vector/text storage.
- **Citations Display:** Interactive citation chips (`[Page 14]`, `[Page 22]`) clicking which highlights the snippet.

---

### E. Admin Review Portal (`/admin`)

#### 1. Authentication & Security
- Protected by admin passcode (`examsetu-admin-2024`).

#### 2. Verification Dashboard
- **Pending Extractions Queue:** Lists newly scraped PDFs and AI-extracted eligibility rules waiting for manual review.
- **Inline Editing & Approval:**
  - Admins can edit post names, minimum/maximum age limits, fee structures, and educational criteria.
  - One-click actions: `Verify & Publish` (`status = 'verified'`) or `Reject`.

---

## 4. Key Data Entities & Relationships (For UI State Modeling)

1. **`Notification` (Parent Card / Notice Row):**
   - `id`, `exam_body`, `title`, `source_url`, `pdf_url`, `status`, `vacancy_count`, `apply_start_date`, `apply_end_date`, `notice_type` (`'recruitment'` | `'update'`), `parent_id`, `first_seen_at`.
   - Nested Relations: `eligibility_rules: EligibilityRule[]`, `updates: Notification[]`.
2. **`EligibilityRule`:**
   - `id`, `notification_id`, `post_name`, `min_age`, `max_age`, `education_requirement`, `domicile_requirement`, `category_relaxations`, `gender_relaxations`, `source_page_ref`, `status`.

---

## 5. Prompting Recommendations for AI UI Generators (Midjourney, v0.dev, Cursor, Bolt, Figma AI)

When prompting UI generators with this document, use the following style keywords:
> *"Create a responsive, dark-mode glassmorphism web application interface for an Indian Government Job Notification & Eligibility Checking Platform called ExamSetu. Use a deep navy background (#080b16) with subtle Indian tricolor (#ff9933 saffron and #138808 green) glowing accents. Design clean, premium cards with high contrast typography, crisp status badges, interactive filter pills, and a side-by-side two-column desktop layout featuring an eligibility calculator on the left and an official updates timeline on the right."*
