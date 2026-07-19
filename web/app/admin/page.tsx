"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import type { EligibilityRule, Notification } from "../../lib/types";

interface RuleWithNotification extends EligibilityRule {
  notifications: Notification;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [rules, setRules] = useState<RuleWithNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RuleWithNotification | null>(null);
  const [filterTab, setFilterTab] = useState<"pending" | "all">("pending");

  // Simple password auth (for MVP — replace with Supabase Auth later)
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    // Check against env var or hardcoded for MVP
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "examsetu-admin-2024";
    if (password === adminPassword) {
      setAuthenticated(true);
      loadRules();
    } else {
      alert("Invalid password");
    }
  }

  async function loadRules(tab: "pending" | "all" = filterTab) {
    setLoading(true);
    try {
      let query = supabase
        .from("eligibility_rules")
        .select("*, notifications(*)")
        .order("extracted_at", { ascending: false });

      if (tab === "pending") {
        query = query.eq("status", "pending_review");
      }

      const { data, error } = await query;
      if (error) throw error;
      setRules((data as RuleWithNotification[]) || []);
    } catch (err) {
      console.error("Failed to load rules:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(ruleId: string) {
    try {
      const { error } = await supabase
        .from("eligibility_rules")
        .update({ status: "verified", reviewed_by: "admin" })
        .eq("id", ruleId);

      if (error) throw error;
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      setSelectedRule(null);
    } catch (err) {
      console.error("Failed to approve:", err);
      alert("Failed to approve rule");
    }
  }

  async function handleReject(ruleId: string) {
    try {
      const { error } = await supabase
        .from("eligibility_rules")
        .update({ status: "rejected", reviewed_by: "admin" })
        .eq("id", ruleId);

      if (error) throw error;
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      setSelectedRule(null);
    } catch (err) {
      console.error("Failed to reject:", err);
    }
  }

  if (!authenticated) {
    return (
      <div className="container" style={{ padding: "80px 20px", maxWidth: 400 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 24, textAlign: "center" }}>
          🔒 Admin Dashboard
        </h1>
        <form onSubmit={handleLogin} className="card">
          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }}>
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "40px 20px" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8 }}>
        🛡️ Admin Review Dashboard
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
        Review and manage LLM-extracted eligibility rules.
      </p>

      <div className="filter-group-pills" style={{ marginBottom: 24 }}>
        <button
          className={`filter-tab ${filterTab === "pending" ? "filter-tab--active" : ""}`}
          onClick={() => { setFilterTab("pending"); loadRules("pending"); }}
        >
          ⏳ Pending Review
        </button>
        <button
          className={`filter-tab ${filterTab === "all" ? "filter-tab--active" : ""}`}
          onClick={() => { setFilterTab("all"); loadRules("all"); }}
        >
          📋 All Extracted Rules
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div className="typing-indicator" style={{ justifyContent: "center" }}>
            <span /><span /><span />
          </div>
        </div>
      ) : rules.length === 0 ? (
        <div className="empty-state">
          <div className="icon">✅</div>
          <p>All caught up! No pending rules to review.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: selectedRule ? "1fr 1fr" : "1fr", gap: 20 }}>
          {/* Rules List */}
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 12 }}>
              {rules.length} rule(s) pending review
            </p>
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="card"
                style={{
                  marginBottom: 12,
                  cursor: "pointer",
                  borderColor: selectedRule?.id === rule.id ? "var(--text-accent)" : undefined,
                }}
                onClick={() => setSelectedRule(rule)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span className="exam-body-badge" style={{ fontSize: "0.7rem" }}>
                    {rule.notifications?.exam_body?.toUpperCase() || "—"}
                  </span>
                  <span style={{
                    fontSize: "0.72rem",
                    color: rule.extraction_confidence && rule.extraction_confidence > 0.7
                      ? "var(--status-verified)" : "var(--status-updated)",
                  }}>
                    Confidence: {((rule.extraction_confidence || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 6 }}>
                  {rule.post_name}
                </h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Age: {rule.min_age || "?"}-{rule.max_age || "?"} |
                  Education: {rule.education_requirement || "—"}
                </p>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          {selectedRule && (
            <div className="card" style={{ position: "sticky", top: 100, alignSelf: "start" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 16 }}>
                {selectedRule.post_name}
              </h3>

              <div style={{ fontSize: "0.88rem", lineHeight: 2 }}>
                <div><strong>Age:</strong> {selectedRule.min_age} - {selectedRule.max_age}</div>
                <div><strong>Category Relaxations:</strong>{" "}
                  {JSON.stringify(selectedRule.category_relaxations)}
                </div>
                <div><strong>Gender Relaxations:</strong>{" "}
                  {JSON.stringify(selectedRule.gender_relaxations)}
                </div>
                <div><strong>Education:</strong> {selectedRule.education_requirement || "—"}</div>
                <div><strong>Domicile:</strong> {selectedRule.domicile_requirement || "—"}</div>
                <div><strong>Fee (General):</strong> ₹{selectedRule.fee_general || "—"}</div>
                <div><strong>Fee (Reserved):</strong> ₹{selectedRule.fee_reserved || "—"}</div>
                <div><strong>Source Ref:</strong> {selectedRule.source_page_ref || "—"}</div>
              </div>

              {selectedRule.notifications?.pdf_url && (
                <a
                  href={selectedRule.notifications.pdf_url}
                  target="_blank"
                  rel="noopener"
                  className="btn btn-ghost"
                  style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
                >
                  📄 View Source PDF
                </a>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => handleApprove(selectedRule.id)}
                >
                  ✅ Approve
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, color: "var(--status-closing)" }}
                  onClick={() => handleReject(selectedRule.id)}
                >
                  ❌ Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
