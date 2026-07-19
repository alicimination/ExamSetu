"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import type { Notification, ChatMessage } from "../../../lib/types";

export default function ChatPage() {
  const params = useParams();
  const examId = params?.examId as string;

  const [notification, setNotification] = useState<Notification | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadNotification() {
      try {
        const { data } = await supabase
          .from("notifications")
          .select("*")
          .eq("id", examId)
          .single();
        if (data) setNotification(data);
      } catch (err) {
        console.error("Failed to load notification:", err);
      } finally {
        setPageLoading(false);
      }
    }
    if (examId) loadNotification();
  }, [examId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      // Call the RAG API (Cloudflare Pages Function)
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          notificationId: examId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "I couldn't find an answer to that question in the notification.",
          citations: data.citations || [],
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I encountered an error processing your question. Please try again. " +
            "If the issue persists, refer to the original PDF for your answer.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (pageLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="typing-indicator">
          <span /><span /><span />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Chat Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-glass)",
        backdropFilter: "blur(20px)",
      }}>
        <a href="/" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          ← Back
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <span style={{ fontSize: "1.5rem" }}>💬</span>
          <div>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 700, lineHeight: 1.3 }}>
              Ask Doubts
            </h1>
            {notification && (
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {notification.exam_body.toUpperCase()} — {notification.title.slice(0, 60)}
                {notification.title.length > 60 ? "..." : ""}
              </p>
            )}
          </div>
        </div>
        <div className="disclaimer" style={{ marginTop: 8, marginBottom: 0, padding: "8px 12px", fontSize: "0.75rem" }}>
          <span>⚠️</span>
          <span>AI answers are based on the notification PDF. Always verify from the official source.</span>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "var(--text-muted)",
          }}>
            <p style={{ fontSize: "2rem", marginBottom: 12 }}>🎓</p>
            <p style={{ fontWeight: 500 }}>Ask anything about this notification</p>
            <p style={{ fontSize: "0.85rem", marginTop: 8 }}>
              Try: &quot;What is the age limit?&quot;, &quot;What is the education requirement?&quot;,
              &quot;What is the application fee?&quot;
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-bubble chat-bubble--${msg.role}`}>
            <div dangerouslySetInnerHTML={{
              __html: msg.content
                .replace(/\[Page (\d+)\]/g, '<span class="chat-citation">📄 Page $1</span>')
                .replace(/\n/g, "<br />"),
            }} />
            {msg.citations && msg.citations.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {msg.citations.map((c, i) => (
                  <span key={i} className="chat-citation">
                    📄 Page {c.page_ref}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="chat-bubble chat-bubble--assistant">
            <div className="typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <input
          className="chat-input"
          placeholder="Ask about eligibility, dates, fees, documents..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          id="chat-input"
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          id="chat-send"
        >
          Send
        </button>
      </div>

      {/* Affiliate placeholder */}
      <div className="ad-slot-placeholder" data-slot="chat-sidebar" />
    </div>
  );
}
