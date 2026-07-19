"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import type { Notification, EligibilityRule } from "../../lib/types";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function DetailsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get("id") || "";

  const [notification, setNotification] = useState<Notification | null>(null);
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [updates, setUpdates] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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
        console.error("Failed to load details data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [examId]);

  if (!examId) {
    return (
      <div className="container" style={{ padding: "60px 20px", textAlign: "center" }}>
        <div className="empty-state">
          <div className="icon">🔍</div>
          <p>No notification selected. <a href="/">Browse notifications</a> to view details.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: "80px 20px", textAlign: "center" }}>
        <div className="typing-indicator" style={{ justifyContent: "center" }}><span /><span /><span /></div>
        <p style={{ color: "var(--text-muted)", marginTop: 16 }}>Loading notification details...</p>
      </div>
    );
  }

  const firstRule = rules[0];

  return (
    <div className="container" style={{ padding: "36px 24px", maxWidth: 1180 }}>
      {/* Top Navigation */}
      <div className="details-page-header">
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/");
            }
          }}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← Back to Notifications
        </button>
      </div>

      {/* Main Title & Badges Header */}
      {notification && (
        <div className="details-title-box">
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <span className="badge-exam-body">NEW NOTIFICATION</span>
            <span className="badge-verified">✓ Confidence: High</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div>
              <h1 className="details-title">{notification.title}</h1>
              <div className="details-meta-window">
                📅 Application window: {formatDate(notification.apply_start_date)} – {formatDate(notification.apply_end_date)}
              </div>
            </div>

            {notification.pdf_url && (
              <a href={notification.pdf_url} target="_blank" rel="noopener" className="btn-apply-now">
                📄 View Official PDF / Apply Now
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Left Rules + Right Sidebar */}
      <div className="details-layout-grid">
        {/* LEFT COLUMN */}
        <div>
          {/* Card 1: Post-Specific Rules */}
          <div className="details-card">
            <h2 className="details-card-title">
              <span>⚡</span> Post-Specific Rules
            </h2>

            <div style={{ background: "#EFF6FF", borderLeft: "4px solid #2563EB", padding: "14px 16px", borderRadius: 8, marginBottom: 16, fontSize: "0.92rem", color: "#1E40AF", fontWeight: 600 }}>
              {firstRule?.education_requirement || "Candidate must have passed 10th/12th/Graduation Examination from a recognized Board in India."}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#10B981", fontWeight: "bold" }}>✓</span>
                <span>Score Card / Eligibility Certificate Mandatory as per notification</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#10B981", fontWeight: "bold" }}>✓</span>
                <span>{firstRule?.domicile_requirement || "Domicile preference applicable for reservation category quotas"}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Age Criteria & Relaxation Table */}
          <div className="details-card">
            <h2 className="details-card-title">
              <span>🎂</span> Age Criteria &amp; Relaxation
            </h2>

            <table className="age-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Max Age</th>
                  <th>Relaxation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>General / Unreserved</td>
                  <td>{firstRule?.max_age ? `${firstRule.max_age} Years` : "40 Years"}</td>
                  <td>Nil</td>
                </tr>
                <tr>
                  <td>OBC (Non-Creamy Layer)</td>
                  <td>{firstRule?.max_age ? `${firstRule.max_age + 5} Years` : "45 Years"}</td>
                  <td className="relaxation-blue">+5 Years</td>
                </tr>
                <tr>
                  <td>SC / ST</td>
                  <td>{firstRule?.max_age ? `${firstRule.max_age + 5} Years` : "45 Years"}</td>
                  <td className="relaxation-blue">+5 Years</td>
                </tr>
                <tr>
                  <td>Ex-Servicemen</td>
                  <td>As per Rules</td>
                  <td className="relaxation-blue">+3 Years</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Card 3: Male & Female Physical Standards Side-by-Side */}
          <div className="standards-grid" style={{ marginBottom: 24 }}>
            {/* Male Standards */}
            <div className="standard-card">
              <div className="standard-title">♂️ Male Standards</div>
              <div className="standard-item">
                <span className="standard-item-label">Height (Gen/OBC)</span>
                <span className="standard-item-val">168 cm</span>
              </div>
              <div className="standard-item">
                <span className="standard-item-label">Chest (Expanded)</span>
                <span className="standard-item-val">84 cm</span>
              </div>
              <div className="standard-item">
                <span className="standard-item-label">Endurance Run</span>
                <span className="standard-item-val">25km in 4hr</span>
              </div>
            </div>

            {/* Female Standards */}
            <div className="standard-card">
              <div className="standard-title">♀️ Female Standards</div>
              <div className="standard-item">
                <span className="standard-item-label">Height (Gen/OBC)</span>
                <span className="standard-item-val">152 cm</span>
              </div>
              <div className="standard-item">
                <span className="standard-item-label">Weight (Min)</span>
                <span className="standard-item-val">45 kg</span>
              </div>
              <div className="standard-item">
                <span className="standard-item-label">Endurance Run</span>
                <span className="standard-item-val">14km in 4hr</span>
              </div>
            </div>
          </div>

          {/* Card 4: Application Fees */}
          <div className="details-card">
            <h2 className="details-card-title">
              <span>💳</span> Application Fees
            </h2>

            <div className="fees-grid">
              <div className="fee-box">
                <div className="fee-label">General</div>
                <div className="fee-amount">₹{firstRule?.fee_general ?? 25}</div>
              </div>
              <div className="fee-box">
                <div className="fee-label">OBC</div>
                <div className="fee-amount">₹{firstRule?.fee_general ?? 25}</div>
              </div>
              <div className="fee-box">
                <div className="fee-label">SC/ST</div>
                <div className="fee-amount">₹{firstRule?.fee_reserved ?? 25}</div>
              </div>
              <div className="fee-box">
                <div className="fee-label">PH</div>
                <div className="fee-amount">₹{firstRule?.fee_reserved ?? 25}</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (SIDEBAR) */}
        <div>
          {/* Latest Notices List */}
          <div className="notices-sidebar-card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 14 }}>
              LATEST NOTICES
            </h3>

            {notification?.pdf_url && (
              <a href={notification.pdf_url} target="_blank" rel="noopener" className="notice-item-link">
                <span>📥 Official Notification PDF</span>
                <span>→</span>
              </a>
            )}

            {updates.map((upd) => (
              <a key={upd.id} href={upd.pdf_url} target="_blank" rel="noopener" className="notice-item-link">
                <span>📥 {upd.title}</span>
                <span>→</span>
              </a>
            ))}

            <a href={`/chat/?id=${examId}`} className="notice-item-link">
              <span>📖 Syllabus &amp; Exam Pattern</span>
              <span>→</span>
            </a>
          </div>

          {/* AI Infodesk Card */}
          <div className="notices-sidebar-card" style={{ textAlign: "center", background: "#F1F5F9" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>✨</div>
            <h4 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
              AI Infodesk
            </h4>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 16 }}>
              Get a personalized roadmap, ask syllabus questions, and clarify exam doubts instantly.
            </p>
            <a href={`/chat/?id=${examId}`} className="btn-apply-now" style={{ width: "100%", justifyContent: "center" }}>
              💬 Start AI Mentor Chat
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DetailsPage() {
  return (
    <Suspense fallback={
      <div className="container" style={{ padding: "80px 20px", textAlign: "center" }}>
        <div className="typing-indicator" style={{ justifyContent: "center" }}><span /><span /><span /></div>
      </div>
    }>
      <DetailsContent />
    </Suspense>
  );
}
