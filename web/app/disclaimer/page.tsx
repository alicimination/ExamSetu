export default function DisclaimerPage() {
  return (
    <div className="container" style={{ padding: "48px 24px", maxWidth: 900 }}>
      <a href="/" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, display: "inline-block" }}>
        ← Back to Notifications
      </a>

      <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
        Disclaimer &amp; Verification Policy
      </h1>
      <p style={{ fontSize: "1rem", color: "var(--text-muted)", marginBottom: 32 }}>
        Important notice regarding the accuracy, scope, and verification requirements of information published on ExamSetu.
      </p>

      <div className="details-card">
        <h2 className="details-card-title">
          <span>⚠️</span> 1. Unofficial Platform Declaration
        </h2>
        <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
          <strong>ExamSetu is a non-governmental, unofficial informational application.</strong> We are not affiliated with, authorized by, endorsed by, or in any way officially connected with the Government of India, any State Government, UPSSSC, UPPRPB, SSC, UPSC, IBPS, Railways, or any other government exam conducting body.
        </p>
        <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          All recruitment titles, organization names, logos, and trademarks belong to their respective official owners.
        </p>
      </div>

      <div className="details-card">
        <h2 className="details-card-title">
          <span>📋</span> 2. Mandatory PDF Verification Requirement
        </h2>
        <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
          All eligibility criteria, age limits, category relaxations, physical standards, syllabus details, and application dates displayed on ExamSetu are extracted via automated pipelines and AI OCR systems.
        </p>
        <div style={{ background: "#EFF6FF", borderLeft: "4px solid #2563EB", padding: "14px 16px", borderRadius: 8, fontSize: "0.9rem", color: "#1E40AF", fontWeight: 600 }}>
          Candidates MUST cross-verify all eligibility rules against the official PDF notification before filling out application forms or paying application fees.
        </div>
      </div>

      <div className="details-card">
        <h2 className="details-card-title">
          <span>🛡️</span> 3. Limitation of Liability
        </h2>
        <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          ExamSetu and its creators shall not be held liable for any loss, damage, candidate rejection, missed deadline, or financial loss arising directly or indirectly from reliance on the data presented on this site.
        </p>
      </div>
    </div>
  );
}
