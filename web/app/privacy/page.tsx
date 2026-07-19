export default function PrivacyPage() {
  return (
    <div className="container" style={{ padding: "48px 24px", maxWidth: 900 }}>
      <a href="/" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, display: "inline-block" }}>
        ← Back to Notifications
      </a>

      <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: "1rem", color: "var(--text-muted)", marginBottom: 32 }}>
        Your privacy is paramount. ExamSetu is built with local browser storage and zero PII harvesting.
      </p>

      <div className="details-card">
        <h2 className="details-card-title">
          <span>🔒</span> 1. Local Browser Storage
        </h2>
        <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          When you enter your profile details (DOB, Gender, Category, Education, Domicile) to check eligibility across jobs, these values are saved exclusively inside your own browser&apos;s <code>localStorage</code> (key: <code>examsetu_profile</code>). They are never sent to or stored on our servers.
        </p>
      </div>

      <div className="details-card">
        <h2 className="details-card-title">
          <span>💬</span> 2. AI Chat &amp; RAG Queries
        </h2>
        <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Questions asked in the AI Mentor chat are processed ephemerally to fetch relevant document chunks from official PDFs. We do not store chat logs associated with your personal identity.
        </p>
      </div>
    </div>
  );
}
