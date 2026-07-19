"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import type { Notification, ChatMessage } from "../../lib/types";

function ChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get("id") || "";

  const [notification, setNotification] = useState<Notification | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(Boolean(examId));
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadNotification() {
      if (!examId) { setPageLoading(false); return; }
      try {
        const { data } = await supabase.from("notifications").select("*").eq("id", examId).single();
        if (data) setNotification(data);
      } catch (err) {
        console.error(err);
      } finally {
        setPageLoading(false);
      }
    }
    loadNotification();
  }, [examId]);

  // Internal container scrolling so the main window page never shifts
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  // Auto refocus input field when AI finishes generating response
  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  async function handleSend(customPrompt?: string) {
    const question = (customPrompt || input).trim();
    if (!question || loading) return;

    if (!customPrompt) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      let contextParts: string[] = [];

      if (examId) {
        // Fetch RAG chunks & eligibility rules for selected exam
        const { data: chunks } = await supabase
          .from("document_chunks")
          .select("chunk_text, page_ref")
          .eq("notification_id", examId)
          .limit(5);

        const { data: rules } = await supabase
          .from("eligibility_rules")
          .select("*")
          .eq("notification_id", examId);

        if (notification) {
          contextParts.push(`Notification Title: ${notification.title}\nExam Body: ${notification.exam_body.toUpperCase()}\nVacancies: ${notification.vacancy_count || "N/A"}\nApply End Date: ${notification.apply_end_date || "N/A"}`);
        }

        if (rules && rules.length > 0) {
          const rulesText = rules.map((r) =>
            `[Rule for Post "${r.post_name}"]: Age: ${r.min_age ?? "18"}-${r.max_age ?? "40"} years. Education: ${r.education_requirement || "N/A"}. Domicile: ${r.domicile_requirement || "Open"}. Additional: ${r.additional_requirements || "None"}. Application Fee: Gen ₹${r.fee_general ?? "N/A"}, Reserved ₹${r.fee_reserved ?? "N/A"}.`
          ).join("\n\n");
          contextParts.push(`Extracted Rules:\n${rulesText}`);
        }

        if (chunks && chunks.length > 0) {
          const chunkText = chunks
            .map((c) => `[Page ${c.page_ref || "?"}]: ${c.chunk_text}`)
            .join("\n\n");
          contextParts.push(`Document Chunks:\n${chunkText}`);
        }
      }

      const context = contextParts.join("\n\n---\n\n");

      const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      const cerebrasKey = process.env.NEXT_PUBLIC_CEREBRAS_API_KEY;

      if (!groqKey && !cerebrasKey) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Chat service API keys are not configured. Please check back later or refer to official PDFs.",
        }]);
        setLoading(false);
        return;
      }

      let answer = "";

      const systemPrompt = `You are ExamSetu AI Mentor, a highly knowledgeable assistant for Indian government exam aspirants (UPSSSC, UP Police, SSC CGL, IBPS, Railways, etc.). Answer accurately, clearly, and concisely. If context is provided, rely on it and include page citations like [Page X] or [Rule] when referencing official document text.`;

      // Try Groq API first
      if (groqKey) {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${groqKey}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: context ? `Context:\n${context}\n\nQuestion: ${question}` : question },
              ],
              temperature: 0.2,
              max_tokens: 1024,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            answer = data.choices[0]?.message?.content || "";
          }
        } catch (e) {
          console.warn("Groq failed, attempting fallback...", e);
        }
      }

      // Fallback to Cerebras API
      if (!answer && cerebrasKey) {
        try {
          const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cerebrasKey}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: context ? `Context:\n${context}\n\nQuestion: ${question}` : question },
              ],
              temperature: 0.2,
              max_tokens: 1024,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            answer = data.choices[0]?.message?.content || "";
          }
        } catch (e) {
          console.error("Cerebras failed:", e);
        }
      }

      if (!answer) {
        answer = "I couldn't fetch an answer right now. Please try rephrasing your question or check the official notification PDF.";
      }

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: answer,
      }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, an error occurred while processing your request. Please try again.",
      }]);
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
        <div className="typing-indicator"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="chat-page-container">
      {/* Top Header Card */}
      <div className="chat-header-card">
        <div className="chat-header-top">
          <div className="chat-header-title-box">
            <div className="chat-header-icon">✨</div>
            <div>
              <h1 className="chat-header-title">
                {notification ? notification.title : "ExamSetu AI Mentor"}
              </h1>
              <p className="chat-header-subtitle">
                {notification
                  ? `${notification.exam_body.toUpperCase()} Official Guidance & RAG Doubt Resolution`
                  : "Ask doubts about UPSSSC, UP Police, SSC CGL, Age Relaxations & Eligibility"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="exam-pill"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else if (examId) {
                  router.push(`/details/?id=${examId}`);
                } else {
                  router.push("/");
                }
              }}
            >
              ← Back
            </button>
            {examId && (
              <button className="exam-pill exam-pill--active" onClick={() => router.push(`/details/?id=${examId}`)}>
                📋 View Details
              </button>
            )}
            {notification?.pdf_url && (
              <a href={notification.pdf_url} target="_blank" rel="noopener" className="exam-pill" style={{ textDecoration: "none" }}>
                📄 PDF
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Interface Card */}
      <div className="chat-main-card">
        {/* Messages Scroll Area */}
        <div className="chat-messages-area" ref={chatContainerRef}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", margin: "auto", maxWidth: 520, padding: "20px 0" }}>
              <div style={{ fontSize: "2.8rem", marginBottom: 12 }}>🎓</div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
                What would you like to know?
              </h2>
              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 20 }}>
                {notification
                  ? `Ask specific questions regarding ${notification.title}. Our AI reads the official PDF notice for precise answers.`
                  : "Ask any doubt about government exams, syllabus, physical standards, or eligibility criteria."}
              </p>

              {/* Suggestion Chips */}
              <div className="chat-suggestion-chips" style={{ justifyContent: "center" }}>
                <button
                  className="chat-chip"
                  onClick={() => handleSend("What is the exact education qualification required?")}
                >
                  🎓 Education Required
                </button>
                <button
                  className="chat-chip"
                  onClick={() => handleSend("What are the minimum and maximum age limits?")}
                >
                  🎂 Age Limit &amp; Relaxation
                </button>
                <button
                  className="chat-chip"
                  onClick={() => handleSend("What is the application fee structure?")}
                >
                  💳 Application Fees
                </button>
                <button
                  className="chat-chip"
                  onClick={() => handleSend("What are the height and physical standards?")}
                >
                  📏 Physical Standards
                </button>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-bubble-row ${msg.role === "user" ? "chat-bubble-row--user" : "chat-bubble-row--assistant"}`}
            >
              <div className={`chat-avatar ${msg.role === "user" ? "chat-avatar--user" : ""}`}>
                {msg.role === "user" ? "👤" : "✨"}
              </div>
              <div
                className={`chat-message-content ${
                  msg.role === "user" ? "chat-message-content--user" : "chat-message-content--assistant"
                }`}
                dangerouslySetInnerHTML={{
                  __html: msg.content
                    .replace(/\[Page (\d+)\]/g, '<span class="chat-citation-badge">📄 Page $1</span>')
                    .replace(/\[Rule\]/g, '<span class="chat-citation-badge">📋 Rule Verified</span>')
                    .replace(/\n/g, "<br />"),
                }}
              />
            </div>
          ))}

          {loading && (
            <div className="chat-bubble-row chat-bubble-row--assistant">
              <div className="chat-avatar">✨</div>
              <div className="chat-message-content chat-message-content--assistant">
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="chat-input-bar-container">
          <input
            ref={inputRef}
            className="chat-input-field"
            placeholder={
              notification
                ? `Ask about ${notification.exam_body.toUpperCase()} notice, dates, cutoff, or rules...`
                : "Ask AI Mentor about any government exam doubt..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            className="chat-send-button"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
          >
            Send ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="typing-indicator"><span /><span /><span /></div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
