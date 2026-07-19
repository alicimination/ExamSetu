"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import type { NotificationVersion } from "../../lib/types";

function ChangesContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("id") || "";

  const [versions, setVersions] = useState<NotificationVersion[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!examId) { setLoading(false); return; }
      try {
        const { data: notif } = await supabase.from("notifications").select("title, exam_body").eq("id", examId).single();
        if (notif) setTitle(`${notif.exam_body.toUpperCase()} — ${notif.title}`);

        const { data } = await supabase.from("notification_versions").select("*")
          .eq("notification_id", examId).order("version_no", { ascending: false });
        if (data) setVersions(data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    loadData();
  }, [examId]);

  if (!examId) return <div className="container empty-state" style={{ padding: 60 }}><p>No exam selected.</p></div>;
  if (loading) return <div className="container" style={{ padding: 60, textAlign: "center" }}><div className="typing-indicator" style={{ justifyContent: "center" }}><span /><span /><span /></div></div>;

  return (
    <div className="container" style={{ padding: "40px 20px", maxWidth: 800 }}>
      <a href="/" style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "inline-block", marginBottom: 24 }}>← Back</a>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8 }}>📋 What Changed</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>{title}</p>

      {versions.length === 0 ? (
        <div className="empty-state"><div className="icon">✨</div><p>No changes detected yet.</p></div>
      ) : (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, width: 2, background: "var(--border-subtle)" }} />
          {versions.map((v) => (
            <div key={v.id} style={{ position: "relative", paddingLeft: 48, marginBottom: 24 }}>
              <div style={{ position: "absolute", left: 10, top: 8, width: 14, height: 14, borderRadius: "50%", background: "var(--status-updated)", border: "3px solid var(--bg-primary)" }} />
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--status-updated)", background: "rgba(255,176,32,0.1)", padding: "3px 10px", borderRadius: 20 }}>
                    Version {v.version_no}
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {new Date(v.detected_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                {v.diff_summary && <div style={{ fontSize: "0.9rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>{v.diff_summary}</div>}
                {v.pdf_url && <a href={v.pdf_url} target="_blank" rel="noopener" className="btn btn-ghost" style={{ marginTop: 12 }}>📄 View PDF</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChangesPage() {
  return <Suspense fallback={<div />}><ChangesContent /></Suspense>;
}
