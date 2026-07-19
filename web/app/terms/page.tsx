export default function TermsPage() {
  return (
    <div className="container" style={{ padding: "48px 24px", maxWidth: 900 }}>
      <a href="/" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, display: "inline-block" }}>
        ← Back to Notifications
      </a>

      <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
        Terms of Service
      </h1>
      <p style={{ fontSize: "1rem", color: "var(--text-muted)", marginBottom: 32 }}>
        Terms and conditions governing the use of ExamSetu web application services.
      </p>

      <div className="details-card">
        <h2 className="details-card-title">
          <span>📜</span> 1. Acceptance of Terms
        </h2>
        <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          By accessing ExamSetu, you agree to use the service for informational and personal guidance only. You acknowledge that ExamSetu is an unofficial aggregator tool and that official notification PDFs remain the single source of truth.
        </p>
      </div>

      <div className="details-card">
        <h2 className="details-card-title">
          <span>⚖️</span> 2. No Legal or Employment Guarantees
        </h2>
        <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          ExamSetu makes no warranties regarding application success, fee exemptions, or exam selection. Users must complete all official applications directly on government recruitment portals (`.gov.in` / `.nic.in`).
        </p>
      </div>
    </div>
  );
}
