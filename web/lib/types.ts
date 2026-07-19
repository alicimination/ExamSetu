/* === Types matching Supabase database schema === */

export interface Notification {
  id: string;
  exam_body: string;
  title: string;
  source_url: string;
  pdf_url: string;
  pdf_storage_path: string | null;
  pdf_hash: string;
  status: "new" | "pending_review" | "verified";
  vacancy_count: number | null;
  apply_start_date: string | null;
  apply_end_date: string | null;
  exam_date: string | null;
  first_seen_at: string;
  updated_at: string;
  notice_type?: "recruitment" | "update";
  parent_id?: string | null;
  eligibility_rules?: EligibilityRule[];
  updates?: Notification[];
}

export interface EligibilityRule {
  id: string;
  notification_id: string;
  post_name: string;
  min_age: number | null;
  max_age: number | null;
  category_relaxations: Record<string, number>;
  gender_relaxations: Record<string, number>;
  education_requirement: string | null;
  domicile_requirement: string | null;
  additional_requirements: string | null;
  fee_general: number | null;
  fee_reserved: number | null;
  source_page_ref: string | null;
  extraction_confidence: number | null;
  status: "pending_review" | "verified" | "rejected";
  extracted_at: string;
}

export interface NotificationVersion {
  id: string;
  notification_id: string;
  version_no: number;
  pdf_hash: string;
  pdf_url: string | null;
  diff_summary: string | null;
  detected_at: string;
}

export interface UserProfile {
  telegram_id: number;
  dob: string | null;
  category: string | null;
  education: string | null;
  state: string | null;
  gender: string | null;
  opted_in_alerts: boolean;
  is_premium: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export interface Citation {
  page_ref: number;
  text_snippet: string;
}

export interface EligibilityCheckResult {
  post_name: string;
  eligible: boolean;
  reasons: string[];
  source_page_ref: string | null;
}

export interface UserEligibilityInput {
  dob: string;
  category: string;
  education: string;
  state: string;
  gender: string;
  // Optional Advanced Physical & Skill Criteria
  height_cm?: number | string | null;
  chest_cm?: number | string | null;
  chest_expansion_cm?: number | string | null;
  eye_vision?: string | null;
  running_capable?: boolean | string | null;
  typing_speed_wpm?: number | string | null;
  computer_certificate?: string | null;
  is_ex_serviceman?: boolean | string | null;
  is_pwd?: boolean | string | null;
}
