"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { checkEligibility } from "../../lib/eligibility-engine";
import type { Notification, EligibilityRule, EligibilityCheckResult, UserEligibilityInput } from "../../lib/types";
import { Suspense } from "react";

const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];
const EDUCATION_LEVELS = ["10th", "12th", "Graduation", "Post-Graduation"];
const STATES = [
  "Uttar Pradesh", "Madhya Pradesh", "Bihar", "Rajasthan", "Maharashtra",
  "Gujarat", "Tamil Nadu", "Karnataka", "West Bengal", "Andhra Pradesh",
  "Telangana", "Kerala", "Punjab", "Haryana", "Jharkhand", "Chhattisgarh",
  "Uttarakhand", "Himachal Pradesh", "Assam", "Odisha", "Delhi", "Other",
];
const GENDERS = ["Male", "Female", "Other"];

function CheckerContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("id") || "";

  const [notification, setNotification] = useState<Notification | null>(null);
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [updates, setUpdates] = useState<Notification[]>([]);
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
      if (!examId) { setLoading(false); return; }
      try {
        const { data: notifData } = await supabase
          .from("notifications").select("*").eq("id", examId).single();
        if (notifData) setNotification(notifData);

        const { data: allNotifs } = await supabase
          .from("notifications")
          .select("*")
          .order("first_seen_at", { ascending: false });

        let roleNotifIds = [examId];
        if (allNotifs && notifData) {
          const title = (notifData.title || "").toLowerCase();
          const isHomeGuard = title.includes("होमगार्ड") || title.includes("home guard") || notifData.id === "b8c30411-84f1-4439-a07d-4778e761e72a";
          const isConstable = title.includes("चालक") || title.includes("आरक्षी") || title.includes("constable");
          const isSI = title.includes("उप निरीक्षक") || title.includes("sub inspector");

          const roleUpdates = allNotifs.filter((n) => {
            if (n.id === notifData.id) return false;
            const t = (n.title || "").toLowerCase();
            if (isHomeGuard && (t.includes("होमगार्ड") || t.includes("home guard"))) return true;
            if (isConstable && (t.includes("चालक") || t.includes("आरक्षी") || t.includes("constable"))) return true;
            if (isSI && (t.includes("उप निरीक्षक") || t.includes("sub inspector"))) return true;
            return n.parent_id === notifData.id;
          });
          setUpdates(roleUpdates);

          roleNotifIds = [notifData.id, ...roleUpdates.map((u) => u.id)];
        }

        const { data: rulesData } = await supabase
          .from("eligibility_rules")
          .select("*")
          .in("notification_id", roleNotifIds);

        if (rulesData) {
          const uniqueMap = new Map();
          for (const r of rulesData) {
            if (!uniqueMap.has(r.post_name)) {
              uniqueMap.set(r.post_name, r);
            }
          }
          setRules(Array.from(uniqueMap.values()));
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [examId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.dob) return;
    setResults(checkEligibility(formData, rules));
  }

  function handleChange(field: keyof UserEligibilityInput, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setResults(null);
  }

  if (!examId) {
    return (
      <div className="container" style={{ padding: "60px 20px", textAlign: "center" }}>
        <div className="empty-state">
          <div className="icon">🔍</div>
          <p>No exam selected. <a href="/">Browse notifications</a> and click &quot;Check Eligibility&quot;.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: "60px 20px", textAlign: "center" }}>
        <div className="typing-indicator" style={{ justifyContent: "center" }}><span /><span /><span /></div>
        <p style={{ color: "var(--text-muted)", marginTop: 16 }}>Loading notification...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "40px 20px", maxWidth: 1150 }}>
      <a href="/" style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 24, display: "inline-block" }}>
        ← Back to Notifications
      </a>

      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8 }}>✅ Eligibility Checker</h1>
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

      <div className="checker-layout-grid">
        {/* LEFT SIDE: Eligibility Checker Form & Results as before */}
        <div>

      <div className="disclaimer">
        <span>⚠️</span>
        <span>
          Always cross-check eligibility criteria with the{" "}
          <a href={notification?.pdf_url || "#"} target="_blank" rel="noopener">original PDF notification</a>.
        </span>
      </div>

      {rules.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="icon">🔍</div>
          <p>No eligibility rules available yet.</p>
          <p style={{ fontSize: "0.85rem", marginTop: 8, color: "var(--text-muted)" }}>
            Rules are being extracted and reviewed. <a href={`/chat/?id=${examId}`}>Ask the AI chat</a> instead.
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="card" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 20, color: "var(--text-accent)" }}>
              Enter Your Details
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="dob">Date of Birth</label>
                <input id="dob" type="date" className="form-input" value={formData.dob}
                  onChange={(e) => handleChange("dob", e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="gender">Gender</label>
                <select id="gender" className="form-select" value={formData.gender}
                  onChange={(e) => handleChange("gender", e.target.value)}>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="category">Category</label>
                <select id="category" className="form-select" value={formData.category}
                  onChange={(e) => handleChange("category", e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="education">Highest Education</label>
                <select id="education" className="form-select" value={formData.education}
                  onChange={(e) => handleChange("education", e.target.value)}>
                  {EDUCATION_LEVELS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="state">State / Domicile</label>
              <select id="state" className="form-select" value={formData.state}
                onChange={(e) => handleChange("state", e.target.value)}>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }}>
              🔍 Check Eligibility
            </button>
          </form>

          {results && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16 }}>Results</h3>
              {results.map((result, idx) => (
                <div key={idx} className={`result-card ${result.eligible ? "result-card--eligible" : "result-card--ineligible"}`}>
                  <div className="result-header">
                    <span className="result-title">{result.post_name}</span>
                    <span className={`result-verdict ${result.eligible ? "result-verdict--pass" : "result-verdict--fail"}`}>
                      {result.eligible ? "✅ Eligible" : "❌ Not Eligible"}
                    </span>
                  </div>
                  <ul className="result-reasons">
                    {result.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
                  </ul>
                  {result.source_page_ref && (
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 8 }}>
                      Source: Page {result.source_page_ref}
                    </p>
                  )}
                </div>
              ))}
              <div className="disclaimer" style={{ marginTop: 20 }}>
                <span>⚠️</span>
                <span>Preliminary check. Verify from the <a href={notification?.pdf_url || "#"} target="_blank" rel="noopener">official notification</a>.</span>
              </div>
            </div>
          )}
        </>
      )}
        </div>

        {/* RIGHT SIDE: Latest Updates & Notices sidebar */}
        <div>
          {updates.length > 0 ? (
            <div className="card card-updates-sidebar">
              <div className="card-updates-header" style={{ fontSize: "0.85rem" }}>
                <span>📢</span>
                <strong>Latest Updates &amp; Notices ({updates.length})</strong>
              </div>
              <div className="card-updates-list" style={{ marginTop: 12 }}>
                {updates.map((upd) => (
                  <div key={upd.id} className="card-update-item">
                    <div className="card-update-text">
                      <span className="card-update-date">
                        {new Date(upd.first_seen_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="card-update-title">{upd.title}</span>
                    </div>
                    <a
                      href={upd.pdf_url}
                      target="_blank"
                      rel="noopener"
                      className="btn btn-ghost card-update-pdf-btn"
                    >
                      📄 Download Notice PDF
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <h4 style={{ fontSize: "0.9rem", color: "var(--text-accent)", marginBottom: 8 }}>
                ℹ️ Official Documents
              </h4>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 12 }}>
                Cross-verify all criteria using the official notification document.
              </p>
              {notification?.pdf_url && (
                <a
                  href={notification.pdf_url}
                  target="_blank"
                  rel="noopener"
                  className="btn btn-secondary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  📄 View Main PDF
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EligibilityCheckerPage() {
  return (
    <Suspense fallback={
      <div className="container" style={{ padding: "60px 20px", textAlign: "center" }}>
        <div className="typing-indicator" style={{ justifyContent: "center" }}><span /><span /><span /></div>
      </div>
    }>
      <CheckerContent />
    </Suspense>
  );
}
