"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { checkEligibility } from "../lib/eligibility-engine";
import type { Notification, UserEligibilityInput, EligibilityCheckResult } from "../lib/types";

const EXAM_BODIES = [
  { id: "all", label: "All Exams" },
  { id: "upsssc", label: "UPSSSC" },
  { id: "uppbpb", label: "UPPBPB" },
  { id: "ssc", label: "SSC" },
  { id: "ibps", label: "Bank (IBPS)" },
];
const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];
const EDUCATION_LEVELS = ["10th Pass", "12th Pass", "Graduation", "Post-Graduation"];
const STATES = [
  "Uttar Pradesh", "Madhya Pradesh", "Bihar", "Rajasthan", "Maharashtra",
  "Gujarat", "Tamil Nadu", "Karnataka", "West Bengal", "Andhra Pradesh",
  "Telangana", "Kerala", "Punjab", "Haryana", "Jharkhand", "Chhattisgarh",
  "Uttarakhand", "Himachal Pradesh", "Assam", "Odisha", "Delhi", "Other",
];
const GENDERS = ["Male", "Female", "Other"];

function getStatusBadge(notification: Notification) {
  if (notification.apply_end_date) {
    const endDate = new Date(notification.apply_end_date);
    const now = new Date();
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return { class: "status-badge--closing", label: "Closed" };
    if (daysLeft <= 7) return { class: "status-badge--closing", label: `${daysLeft}d left` };
  }

  if (
    notification.status === "verified" ||
    (notification.eligibility_rules &&
      notification.eligibility_rules.some((r) => r.status === "verified"))
  ) {
    return { class: "badge-verified", label: "VERIFIED" };
  }

  if (notification.status === "new") return { class: "badge-verified", label: "NEW" };
  return { class: "badge-verified", label: "REVIEW" };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short",
  });
}

function getOpenPositionTitle(notification: Notification): string {
  const rules = notification.eligibility_rules;
  if (rules && rules.length > 0) {
    const uniquePosts = Array.from(
      new Set(rules.map((r) => r.post_name).filter(Boolean))
    );
    if (uniquePosts.length === 1) return uniquePosts[0];
    if (uniquePosts.length === 2) return `${uniquePosts[0]} & ${uniquePosts[1]}`;
    if (uniquePosts.length > 2) {
      return `${uniquePosts[0]}, ${uniquePosts[1]} +${uniquePosts.length - 2} more`;
    }
  }

  let clean = notification.title.replace(/\.pdf$/i, "").replace(/_/g, " ").trim();
  if (clean.toLowerCase() === "faqs") return "General Notice / FAQs";
  if (/^Adobe Scan/i.test(clean) || /^[0-9a-f]{8}-/i.test(clean)) {
    return `${notification.exam_body.toUpperCase()} Official Notification`;
  }
  return clean;
}

function getRoleGroupKey(n: Notification): string {
  if (n.parent_id) return n.parent_id;
  const title = (n.title || "").toLowerCase();
  const postNames = (n.eligibility_rules || []).map((r) => r.post_name.toLowerCase());

  if (title.includes("होमगार्ड") || title.includes("home guard") || postNames.some((p) => p.includes("home guard"))) {
    return "role:up_home_guard_2025";
  }
  if (title.includes("चालक") || title.includes("आरक्षी") || title.includes("constable") || postNames.some((p) => p.includes("constable"))) {
    return "role:up_police_constable_2025";
  }
  if (title.includes("उप निरीक्षक") || title.includes("sub inspector") || title.includes("assistant sub") || postNames.some((p) => p.includes("inspector"))) {
    return "role:up_police_si_asi_2025";
  }
  if (title === "faqs" || title.includes("faq")) {
    return "role:faqs";
  }
  return `single:${n.id}`;
}

function groupNotificationsByRole(notifications: Notification[]): Notification[] {
  const groups = new Map<string, { all: Notification[]; allRules: any[] }>();

  for (const n of notifications) {
    const key = getRoleGroupKey(n);
    if (!groups.has(key)) {
      groups.set(key, { all: [], allRules: [] });
    }
    const group = groups.get(key)!;
    group.all.push(n);
    if (n.eligibility_rules) {
      group.allRules.push(...n.eligibility_rules);
    }
  }

  const result: Notification[] = [];
  for (const group of groups.values()) {
    const sorted = [...group.all].sort(
      (a, b) => new Date(a.first_seen_at).getTime() - new Date(b.first_seen_at).getTime()
    );
    const mainNotice =
      sorted.find((n) => n.notice_type === "recruitment") || sorted[0];

    const updates = group.all
      .filter((n) => n.id !== mainNotice.id)
      .sort((a, b) => new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime());

    const uniqueRulesMap = new Map();
    for (const r of group.allRules) {
      if (!uniqueRulesMap.has(r.post_name)) {
        uniqueRulesMap.set(r.post_name, r);
      }
    }

    result.push({
      ...mainNotice,
      eligibility_rules: Array.from(uniqueRulesMap.values()),
      updates,
    });
  }

  return result.sort(
    (a, b) => new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime()
  );
}

type EligibilityStatus = "eligible" | "ineligible" | "manual";

function getNotificationEligibility(
  notification: Notification,
  userInput: UserEligibilityInput
): { status: EligibilityStatus; results: EligibilityCheckResult[] } {
  const rules = notification.eligibility_rules || [];
  if (rules.length === 0) {
    return { status: "manual", results: [] };
  }
  const results = checkEligibility(userInput, rules);
  const anyEligible = results.some((r) => r.eligible);
  return {
    status: anyEligible ? "eligible" : "ineligible",
    results,
  };
}

export default function HomePage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [examBodyFilter, setExamBodyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [educationFilter, setEducationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    setVisibleCount(12);
  }, [searchQuery, examBodyFilter, statusFilter, educationFilter, sortBy]);

  // Eligibility form state
  const [formData, setFormData] = useState<UserEligibilityInput>({
    dob: "2000-01-01",
    category: "General",
    education: "10th Pass",
    state: "Uttar Pradesh",
    gender: "Male",
    height_cm: "",
    chest_cm: "",
    chest_expansion_cm: "",
    eye_vision: "",
    running_capable: "",
    typing_speed_wpm: "",
    computer_certificate: "",
    is_ex_serviceman: "",
    is_pwd: "",
  });
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem("examsetu_profile");
      const savedChecked = localStorage.getItem("examsetu_eligibility_checked");
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        setFormData(parsed);
        if (savedChecked === "true" && parsed.dob) {
          setEligibilityChecked(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    async function fetchNotifications() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*, eligibility_rules(*)")
          .order("first_seen_at", { ascending: false })
          .limit(100);

        if (error) throw error;
        setNotifications(groupNotificationsByRole(data || []));
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, []);

  const eligibilityMap = useMemo(() => {
    if (!eligibilityChecked || !formData.dob) return new Map<string, { status: EligibilityStatus; results: EligibilityCheckResult[] }>();
    const map = new Map<string, { status: EligibilityStatus; results: EligibilityCheckResult[] }>();
    for (const n of notifications) {
      map.set(n.id, getNotificationEligibility(n, formData));
    }
    return map;
  }, [eligibilityChecked, formData, notifications]);

  const eligibleCount = Array.from(eligibilityMap.values()).filter((v) => v.status === "eligible").length;
  const ineligibleCount = Array.from(eligibilityMap.values()).filter((v) => v.status === "ineligible").length;
  const manualCount = Array.from(eligibilityMap.values()).filter((v) => v.status === "manual").length;

  const filteredNotifications = notifications
    .filter((n) => {
      if (examBodyFilter !== "all" && n.exam_body !== examBodyFilter) {
        return false;
      }
      if (statusFilter !== "all" && n.status !== statusFilter) {
        return false;
      }
      if (educationFilter !== "all") {
        const rules = n.eligibility_rules || [];
        const eduQuery = educationFilter.toLowerCase().replace(" pass", "");
        const matchesEdu = rules.some((r) =>
          r.education_requirement?.toLowerCase().includes(eduQuery)
        );
        if (!matchesEdu && rules.length > 0) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const positionTitle = getOpenPositionTitle(n).toLowerCase();
        const rawTitle = (n.title || "").toLowerCase();
        const examBody = (n.exam_body || "").toLowerCase();
        const ruleText = (n.eligibility_rules || [])
          .map(
            (r) =>
              `${r.post_name} ${r.education_requirement || ""} ${r.domicile_requirement || ""} ${r.additional_requirements || ""}`
          )
          .join(" ")
          .toLowerCase();

        if (
          !positionTitle.includes(q) &&
          !rawTitle.includes(q) &&
          !examBody.includes(q) &&
          !ruleText.includes(q)
        ) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (eligibilityChecked) {
        const aStatus = eligibilityMap.get(a.id)?.status || "manual";
        const bStatus = eligibilityMap.get(b.id)?.status || "manual";
        const order: Record<EligibilityStatus, number> = { eligible: 0, manual: 1, ineligible: 2 };
        if (order[aStatus] !== order[bStatus]) {
          return order[aStatus] - order[bStatus];
        }
      }

      if (sortBy === "vacancies") {
        return (b.vacancy_count || 0) - (a.vacancy_count || 0);
      }
      if (sortBy === "closing_soon") {
        const aEnd = a.apply_end_date
          ? new Date(a.apply_end_date).getTime()
          : 8640000000000000;
        const bEnd = b.apply_end_date
          ? new Date(b.apply_end_date).getTime()
          : 8640000000000000;
        return aEnd - bEnd;
      }
      return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime();
    });

  function handleFormChange(field: keyof UserEligibilityInput, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setEligibilityChecked(false);
    try {
      localStorage.setItem("examsetu_eligibility_checked", "false");
    } catch {
      // ignore
    }
  }

  function handleCheckAll(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.dob) return;
    try {
      localStorage.setItem("examsetu_profile", JSON.stringify(formData));
      localStorage.setItem("examsetu_eligibility_checked", "true");
    } catch {
      // ignore
    }
    setEligibilityChecked(true);
  }

  function handleClearEligibility() {
    setEligibilityChecked(false);
    try {
      localStorage.setItem("examsetu_eligibility_checked", "false");
    } catch {
      // ignore
    }
  }

  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <h1>
            Track Sarkari Exams | <span className="blue-text">Check Eligibility Instantly</span>
          </h1>
          <p className="hero-subtitle">
            Stop scouring dozens of PDFs. Input your profile once and get personalized
            alerts for only the jobs you&apos;re qualified to apply for.
          </p>

          {/* Floating Inline Eligibility Card */}
          <form className="hero-form-card" onSubmit={handleCheckAll}>
            <div className="hero-form-grid">
              <div className="form-group-compact">
                <label className="form-label-compact" htmlFor="hero-dob">DOB</label>
                <input
                  id="hero-dob"
                  type="date"
                  className="form-input-compact"
                  value={formData.dob}
                  onChange={(e) => handleFormChange("dob", e.target.value)}
                  required
                />
              </div>

              <div className="form-group-compact">
                <label className="form-label-compact" htmlFor="hero-gender">Gender</label>
                <select
                  id="hero-gender"
                  className="form-select-compact"
                  value={formData.gender}
                  onChange={(e) => handleFormChange("gender", e.target.value)}
                >
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div className="form-group-compact">
                <label className="form-label-compact" htmlFor="hero-category">Category</label>
                <select
                  id="hero-category"
                  className="form-select-compact"
                  value={formData.category}
                  onChange={(e) => handleFormChange("category", e.target.value)}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group-compact">
                <label className="form-label-compact" htmlFor="hero-education">Education</label>
                <select
                  id="hero-education"
                  className="form-select-compact"
                  value={formData.education}
                  onChange={(e) => handleFormChange("education", e.target.value)}
                >
                  {EDUCATION_LEVELS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div className="form-group-compact">
                <label className="form-label-compact" htmlFor="hero-state">Domicile</label>
                <select
                  id="hero-state"
                  className="form-select-compact"
                  value={formData.state}
                  onChange={(e) => handleFormChange("state", e.target.value)}
                >
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Collapsible Advanced Criteria */}
            {showAdvanced && (
              <div className="hero-form-advanced">
                <div className="advanced-form-grid">
                  <div className="form-group-compact">
                    <label className="form-label-compact" htmlFor="hero-height">📏 Height (cm)</label>
                    <input
                      id="hero-height"
                      type="number"
                      className="form-input-compact"
                      placeholder="e.g. 168"
                      value={formData.height_cm || ""}
                      onChange={(e) => handleFormChange("height_cm", e.target.value)}
                    />
                  </div>

                  {formData.gender === "Male" && (
                    <>
                      <div className="form-group-compact">
                        <label className="form-label-compact" htmlFor="hero-chest">📏 Chest (cm)</label>
                        <input
                          id="hero-chest"
                          type="number"
                          className="form-input-compact"
                          placeholder="e.g. 79"
                          value={formData.chest_cm || ""}
                          onChange={(e) => handleFormChange("chest_cm", e.target.value)}
                        />
                      </div>
                      <div className="form-group-compact">
                        <label className="form-label-compact" htmlFor="hero-chest-exp">📏 Chest Expansion (cm)</label>
                        <input
                          id="hero-chest-exp"
                          type="number"
                          className="form-input-compact"
                          placeholder="e.g. 5"
                          value={formData.chest_expansion_cm || ""}
                          onChange={(e) => handleFormChange("chest_expansion_cm", e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="form-group-compact">
                    <label className="form-label-compact" htmlFor="hero-running">🏃 Running Test</label>
                    <select
                      id="hero-running"
                      className="form-select-compact"
                      value={formData.running_capable ? String(formData.running_capable) : ""}
                      onChange={(e) => handleFormChange("running_capable", e.target.value)}
                    >
                      <option value="">Optional</option>
                      <option value="true">Yes — Capable</option>
                      <option value="false">No — Not Capable</option>
                    </select>
                  </div>

                  <div className="form-group-compact">
                    <label className="form-label-compact" htmlFor="hero-vision">👁️ Vision</label>
                    <select
                      id="hero-vision"
                      className="form-select-compact"
                      value={formData.eye_vision || ""}
                      onChange={(e) => handleFormChange("eye_vision", e.target.value)}
                    >
                      <option value="">Optional</option>
                      <option value="6/6">6/6 (Clear)</option>
                      <option value="6/9">6/9 (Good)</option>
                      <option value="6/12 or worse">6/12 or worse</option>
                    </select>
                  </div>

                  <div className="form-group-compact">
                    <label className="form-label-compact" htmlFor="hero-typing">⌨️ Typing Speed (WPM)</label>
                    <input
                      id="hero-typing"
                      type="number"
                      className="form-input-compact"
                      placeholder="e.g. 30"
                      value={formData.typing_speed_wpm || ""}
                      onChange={(e) => handleFormChange("typing_speed_wpm", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="hero-form-bottom-row">
              <button
                type="button"
                className="advanced-toggle-btn"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>⚙️ Advanced Criteria</span>
                <span>{showAdvanced ? "▲" : "▼"}</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {eligibilityChecked && (
                  <button type="button" className="advanced-toggle-btn" onClick={handleClearEligibility}>
                    Reset Check
                  </button>
                )}
                <button type="submit" className="btn-check-all">
                  🔍 Check All Jobs
                </button>
              </div>
            </div>

            {/* Eligibility Results summary bar */}
            {eligibilityChecked && (
              <div style={{ display: "flex", gap: 16, marginTop: 14, paddingTop: 14, borderTop: "1px solid #E2E8F0", fontSize: "0.88rem", fontWeight: 700 }}>
                <span style={{ color: "#16A34A" }}>✅ {eligibleCount} Eligible</span>
                <span style={{ color: "#DC2626" }}>❌ {ineligibleCount} Ineligible</span>
                <span style={{ color: "#D97706" }}>⚠️ {manualCount} Check Manually</span>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Dark Stats Banner */}
      <section className="dark-stats-banner">
        <div className="container">
          <div className="dark-stats-grid">
            <div className="dark-stat-item">
              <div className="dark-stat-value">{loading ? "120+" : `${notifications.length}+`}</div>
              <div className="dark-stat-label">ACTIVE NOTIFICATIONS</div>
            </div>
            <div className="dark-stat-item">
              <div className="dark-stat-value">45+</div>
              <div className="dark-stat-label">EXAM BODIES TRACKED</div>
            </div>
            <div className="dark-stat-item">
              <div className="dark-stat-value">24/7</div>
              <div className="dark-stat-label">AUTO TRACKING ENGINE</div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section id="notifications" className="container">
        <div className="filter-search-box">
          <div className="search-input-pill">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by post, department, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery("")}>
                ✕
              </button>
            )}
          </div>

          <div className="exam-pill-group">
            {EXAM_BODIES.map((body) => (
              <button
                key={body.id}
                className={`exam-pill ${examBodyFilter === body.id ? "exam-pill--active" : ""}`}
                onClick={() => setExamBodyFilter(body.id)}
              >
                {body.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <select
              className="filter-dropdown-pill"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Status: All</option>
              <option value="verified">Verified</option>
              <option value="new">New</option>
            </select>

            <select
              className="filter-dropdown-pill"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="latest">Sort By: Newest</option>
              <option value="vacancies">Sort By: Vacancies</option>
              <option value="closing_soon">Sort By: Closing Soon</option>
            </select>
          </div>
        </div>

        {/* Job Cards Grid */}
        {loading ? (
          <div className="card-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="job-card" style={{ height: 260 }}>
                <div className="skeleton" style={{ height: 20, width: "50%", marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 24, width: "80%", marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 16, width: "60%", marginBottom: 20 }} />
                <div className="skeleton" style={{ height: 40, width: "100%" }} />
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🔍</div>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              No notifications found matching your search.
            </p>
            <button
              className="btn-check-all"
              style={{ marginTop: 16 }}
              onClick={() => {
                setSearchQuery("");
                setExamBodyFilter("all");
                setStatusFilter("all");
                setEducationFilter("all");
              }}
            >
              🔄 Reset Filters
            </button>
          </div>
        ) : (
          <div className="card-grid">
            {filteredNotifications.slice(0, visibleCount).map((n) => {
              const badge = getStatusBadge(n);
              const eligibility = eligibilityMap.get(n.id);

              return (
                <div
                  key={n.id}
                  className="job-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/details/?id=${n.id}`)}
                >
                  <div>
                    {/* Header Badges */}
                    <div className="job-card-top">
                      <span className="badge-exam-body">{n.exam_body.toUpperCase()}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span className="badge-verified">{badge.label}</span>
                        {eligibilityChecked && eligibility && (
                          <span
                            className={
                              eligibility.status === "eligible"
                                ? "badge-eligible"
                                : eligibility.status === "ineligible"
                                ? "badge-ineligible"
                                : "badge-verified"
                            }
                          >
                            {eligibility.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Job Title & Org */}
                    <h3 className="job-title">{getOpenPositionTitle(n)}</h3>
                    <p className="job-org">
                      {n.exam_body === "upsssc"
                        ? "Uttar Pradesh Subordinate Services Selection Commission"
                        : n.exam_body === "uppbpb"
                        ? "Uttar Pradesh Police Recruitment Board"
                        : n.exam_body === "ssc"
                        ? "Staff Selection Commission"
                        : "Official Recruitment Board"}
                    </p>

                    {/* Stat Boxes Row */}
                    <div className="job-stats-row">
                      <div className="job-stat-box">
                        <div className="job-stat-title">VACANCIES</div>
                        <div className="job-stat-value">
                          {n.vacancy_count ? n.vacancy_count.toLocaleString() : "N/A"}
                        </div>
                      </div>

                      <div className="job-stat-box job-stat-box--alert">
                        <div className="job-stat-title">LAST DATE</div>
                        <div className="job-stat-value job-stat-value--red">
                          {(() => {
                            const endDate = n.apply_end_date || (n.updates && n.updates.find((u) => u.apply_end_date)?.apply_end_date);
                            return endDate ? formatDate(endDate) : "N/A";
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Key Requirements Box */}
                    <div className="job-requirements-box">
                      <div className="job-req-title">KEY REQUIREMENTS</div>
                      <div className="job-req-list">
                        {n.eligibility_rules && n.eligibility_rules.length > 0 ? (
                          <>
                            {n.eligibility_rules[0].education_requirement && (
                              <div className="job-req-item">
                                <span className="check-icon">✓</span>
                                <span>{n.eligibility_rules[0].education_requirement}</span>
                              </div>
                            )}
                            {(n.eligibility_rules[0].min_age !== null || n.eligibility_rules[0].max_age !== null) && (
                              <div className="job-req-item">
                                <span className="check-icon">✓</span>
                                <span>
                                  Age: {n.eligibility_rules[0].min_age ?? "18"}–{n.eligibility_rules[0].max_age ?? "40"} Years
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="job-req-item">
                            <span className="check-icon">✓</span>
                            <span>Official Eligibility Rules Available</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Updates Alert Banner */}
                    {n.updates && n.updates.length > 0 && (
                      <div className="job-alert-banner">
                        <span>⚡</span>
                        <span>Update: {n.updates[0].title}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="job-card-actions" onClick={(e) => e.stopPropagation()}>
                    <a href={`/details/?id=${n.id}`} className="btn-view-details">
                      📋 View Details
                    </a>
                    {n.pdf_url && (
                      <a
                        href={n.pdf_url}
                        target="_blank"
                        rel="noopener"
                        className="btn-icon-action"
                        title="View Official PDF"
                      >
                        📑
                      </a>
                    )}
                    <a
                      href={`/chat/?id=${n.id}`}
                      className="btn-icon-action"
                      title="Ask AI Mentor"
                    >
                      💬
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Pagination */}
        {filteredNotifications.length > visibleCount ? (
          <div className="load-more-container">
            <button
              className="btn-load-more"
              onClick={() => setVisibleCount((prev) => prev + 12)}
            >
              Load {filteredNotifications.length - visibleCount} More Jobs →
            </button>
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="load-more-container">
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              Showing all {filteredNotifications.length} available jobs
            </p>
          </div>
        ) : null}
      </section>
    </>
  );
}
