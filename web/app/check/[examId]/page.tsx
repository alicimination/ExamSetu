"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { checkEligibility } from "../../../lib/eligibility-engine";
import type { Notification, EligibilityRule, EligibilityCheckResult, UserEligibilityInput } from "../../../lib/types";

const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];
const EDUCATION_LEVELS = ["10th", "12th", "Graduation", "Post-Graduation"];
const STATES = [
  "Uttar Pradesh", "Madhya Pradesh", "Bihar", "Rajasthan", "Maharashtra",
  "Gujarat", "Tamil Nadu", "Karnataka", "West Bengal", "Andhra Pradesh",
  "Telangana", "Kerala", "Punjab", "Haryana", "Jharkhand", "Chhattisgarh",
  "Uttarakhand", "Himachal Pradesh", "Assam", "Odisha", "Delhi", "Other",
];
const GENDERS = ["Male", "Female", "Other"];

export default function EligibilityCheckerPage() {
  const params = useParams();
  const examId = params?.examId as string;

  const [notification, setNotification] = useState<Notification | null>(null);
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<EligibilityCheckResult[] | null>(null);

  const [formData, setFormData] = useState<UserEligibilityInput>({
    dob: "",
    category: "General",
    education: "Graduation",
    state: "Uttar Pradesh",
    gender: "Male",
  });

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch notification details
        const { data: notifData } = await supabase
          .from("notifications")
          .select("*")
          .eq("id", examId)
          .single();

        if (notifData) setNotification(notifData);

        // Fetch verified eligibility rules
        const { data: rulesData } = await supabase
          .from("eligibility_rules")
          .select("*")
          .eq("notification_id", examId)
          .eq("status", "verified");

        if (rulesData) setRules(rulesData);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    }
    if (examId) loadData();
  }, [examId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.dob) return;
    const checkResults = checkEligibility(formData, rules);
    setResults(checkResults);
  }

  function handleChange(field: keyof UserEligibilityInput, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setResults(null); // Reset results on change
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: "60px 20px", textAlign: "center" }}>
        <div className="typing-indicator" style={{ justifyContent: "center" }}>
          <span /><span /><span />
        </div>
        <p style={{ color: "var(--text-muted)", marginTop: 16 }}>Loading notification...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "40px 20px", maxWidth: 800 }}>
      {/* Back link */}
      <a href="/" style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 24, display: "inline-block" }}>
        ← Back to Notifications
      </a>

      {/* Header */}
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8 }}>
        ✅ Eligibility Checker
      </h1>
      {notification && (
        <div style={{ marginBottom: 24 }}>
          <span className="exam-body-badge" style={{ marginBottom: 8, display: "inline-flex" }}>
            🏛️ {notification.exam_body.toUpperCase()}
          </span>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-secondary)", marginTop: 8 }}>
            {notification.title}
          </h2>
        </div>
      )}

      {/* Disclaimer */}
      <div className="disclaimer">
        <span>⚠️</span>
        <span>
          This checker uses only <strong>verified</strong> rules extracted from the
          official notification. Always cross-check with the{" "}
          <a href={notification?.pdf_url || "#"} target="_blank" rel="noopener">
            original PDF
          </a>.
        </span>
      </div>

      {rules.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="icon">🔍</div>
          <p>No verified eligibility rules available yet.</p>
          <p style={{ fontSize: "0.85rem", marginTop: 8, color: "var(--text-muted)" }}>
            Rules are being extracted and reviewed. Check back soon, or{" "}
            <a href={`/chat/${examId}/`}>ask the AI chat</a> for help.
          </p>
        </div>
      ) : (
        <>
          {/* Form */}
          <form onSubmit={handleSubmit} className="card" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 20, color: "var(--text-accent)" }}>
              Enter Your Details
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="dob">Date of Birth</label>
                <input
                  id="dob"
                  type="date"
                  className="form-input"
                  value={formData.dob}
                  onChange={(e) => handleChange("dob", e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  className="form-select"
                  value={formData.gender}
                  onChange={(e) => handleChange("gender", e.target.value)}
                >
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="category">Category</label>
                <select
                  id="category"
                  className="form-select"
                  value={formData.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="education">Highest Education</label>
                <select
                  id="education"
                  className="form-select"
                  value={formData.education}
                  onChange={(e) => handleChange("education", e.target.value)}
                >
                  {EDUCATION_LEVELS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="state">State / Domicile</label>
              <select
                id="state"
                className="form-select"
                value={formData.state}
                onChange={(e) => handleChange("state", e.target.value)}
              >
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }}>
              🔍 Check Eligibility
            </button>
          </form>

          {/* Results */}
          {results && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16 }}>
                Results
              </h3>
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`result-card ${result.eligible ? "result-card--eligible" : "result-card--ineligible"}`}
                >
                  <div className="result-header">
                    <span className="result-title">{result.post_name}</span>
                    <span className={`result-verdict ${result.eligible ? "result-verdict--pass" : "result-verdict--fail"}`}>
                      {result.eligible ? "✅ Eligible" : "❌ Not Eligible"}
                    </span>
                  </div>
                  <ul className="result-reasons">
                    {result.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                  {result.source_page_ref && (
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 8 }}>
                      Source: Page {result.source_page_ref} of notification PDF
                    </p>
                  )}
                </div>
              ))}

              <div className="disclaimer" style={{ marginTop: 20 }}>
                <span>⚠️</span>
                <span>
                  This is a preliminary check based on extracted data. Please verify
                  from the{" "}
                  <a href={notification?.pdf_url || "#"} target="_blank" rel="noopener">
                    official notification
                  </a>{" "}
                  before applying.
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
