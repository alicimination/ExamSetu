export default function FAQPage() {
  const faqs = [
    {
      q: "How does the Instant Eligibility Checker work?",
      a: "When you enter your Date of Birth, Gender, Category, Education, and State in the hero form, ExamSetu runs a client-side deterministic evaluation comparing your profile against all active eligibility rules extracted from official PDFs."
    },
    {
      q: "Are the physical measurement requirements mandatory?",
      a: "No! The Advanced Criteria drawer (Height, Chest, Vision, Typing Speed, etc.) is completely optional. If you fill them in, ExamSetu will evaluate physical standards for police/forest guard posts; if left empty, eligibility is checked based on age and education alone."
    },
    {
      q: "Is ExamSetu free to use?",
      a: "Yes, 100% free! You can track notifications, check eligibility, and ask doubts in the AI Mentor chat without any fees."
    },
    {
      q: "What should I do if I find a discrepancy in a rule or date?",
      a: "Always verify the original PDF notice linked on every job card via the PDF button. If you spot a discrepancy, you can use the AI Chat to ask specific syllabus and rule questions."
    }
  ];

  return (
    <div className="container" style={{ padding: "48px 24px", maxWidth: 900 }}>
      <a href="/" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, display: "inline-block" }}>
        ← Back to Notifications
      </a>

      <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
        Frequently Asked Questions (FAQs)
      </h1>
      <p style={{ fontSize: "1rem", color: "var(--text-muted)", marginBottom: 32 }}>
        Everything you need to know about ExamSetu eligibility checking and notification tracking.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {faqs.map((faq, idx) => (
          <div key={idx} className="details-card">
            <h2 className="details-card-title" style={{ fontSize: "1.05rem" }}>
              <span>❓</span> {faq.q}
            </h2>
            <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {faq.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
