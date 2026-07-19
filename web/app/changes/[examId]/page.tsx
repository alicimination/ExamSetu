"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import type { Notification, NotificationVersion } from "../../../lib/types";

export default function ChangesPage() {
  const params = useParams();
  const examId = params?.examId as string;

  const [notification, setNotification] = useState<Notification | null>(null);
  const [versions, setVersions] = useState<NotificationVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: notifData } = await supabase
          .from("notifications")
          .select("*")
          .eq("id", examId)
          .single();
        if (notifData) setNotification(notifData);

        const { data: versionsData } = await supabase
          .from("notification_versions")
          .select("*")
          .eq("notification_id", examId)
          .order("version_no", { ascending: false });
        if (versionsData) setVersions(versionsData);
      } catch (err) {
        console.error("Failed to load changes:", err);
      } finally {
        setLoading(false);
      }
    }
    if (examId) loadData();
  }, [examId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: "60px 20px", textAlign: "center" }}>
        <div className="typing-indicator" style={{ justifyContent: "center" }}>
          <span /><span /><span />
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "40px 20px", maxWidth: 800 }}>
      <a href="/" style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "inline-block", marginBottom: 24 }}>
        ← Back to Notifications
      </a>

      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8 }}>
        📋 What Changed
      </h1>
      {notification && (
        <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
          {notification.exam_body.toUpperCase()} — {notification.title}
        </p>
      )}

      {versions.length === 0 ? (
        <div className="empty-state">
          <div className="icon">✨</div>
          <p>No changes detected yet.</p>
          <p style={{ fontSize: "0.85rem", marginTop: 8, color: "var(--text-muted)" }}>
            This notification has not been updated since it was first detected.
          </p>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Timeline line */}
          <div style={{
            position: "absolute",
            left: 16,
            top: 0,
            bottom: 0,
            width: 2,
            background: "var(--border-subtle)",
          }} />

          {versions.map((version) => (
            <div key={version.id} style={{
              position: "relative",
              paddingLeft: 48,
              marginBottom: 24,
            }}>
              {/* Timeline dot */}
              <div style={{
                position: "absolute",
                left: 10,
                top: 8,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "var(--status-updated)",
                border: "3px solid var(--bg-primary)",
              }} />

              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--status-updated)",
                    background: "rgba(255, 176, 32, 0.1)",
                    padding: "3px 10px",
                    borderRadius: 20,
                  }}>
                    Version {version.version_no}
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {new Date(version.detected_at).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>

                {version.diff_summary && (
                  <div style={{
                    fontSize: "0.9rem",
                    color: "var(--text-primary)",
                    lineHeight: 1.7,
                    whiteSpace: "pre-line",
                  }}>
                    {version.diff_summary}
                  </div>
                )}

                {version.pdf_url && (
                  <a
                    href={version.pdf_url}
                    target="_blank"
                    rel="noopener"
                    className="btn btn-ghost"
                    style={{ marginTop: 12 }}
                  >
                    📄 View this version&apos;s PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
