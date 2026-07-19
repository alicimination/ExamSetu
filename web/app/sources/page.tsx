export default function SourcesPage() {
  const sources = [
    { name: "UPSSSC", full: "Uttar Pradesh Subordinate Services Selection Commission", url: "https://upsssc.gov.in" },
    { name: "UPPRPB / UP Police", full: "Uttar Pradesh Police Recruitment & Promotion Board", url: "https://uppbpb.gov.in" },
    { name: "SSC", full: "Staff Selection Commission", url: "https://ssc.gov.in" },
    { name: "IBPS", full: "Institute of Banking Personnel Selection", url: "https://ibps.in" },
    { name: "UPSC", full: "Union Public Service Commission", url: "https://upsc.gov.in" },
    { name: "Indian Railways / RRB", full: "Railway Recruitment Control Board", url: "https://indianrailways.gov.in" },
    { name: "SarkariResult", full: "SarkariResult Public Aggregator Portal", url: "https://sarkariresult.com.cm" },
  ];

  return (
    <div className="container" style={{ padding: "48px 24px", maxWidth: 900 }}>
      <a href="/" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, display: "inline-block" }}>
        ← Back to Notifications
      </a>

      <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
        Official Data Sources &amp; Integrity
      </h1>
      <p style={{ fontSize: "1rem", color: "var(--text-muted)", marginBottom: 32 }}>
        Complete transparency regarding where ExamSetu monitors and ingests official recruitment notices.
      </p>

      <div className="details-card">
        <h2 className="details-card-title">
          <span>🏛️</span> Monitored Government Portals
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {sources.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#F8FAFC", border: "1px solid var(--border-color)", borderRadius: 8, flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong style={{ color: "var(--text-primary)", fontSize: "0.95rem" }}>{s.name}</strong>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{s.full}</div>
              </div>
              <a href={s.url} target="_blank" rel="noopener" className="btn-icon-action" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                🔗 Visit Official Site →
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="details-card">
        <h2 className="details-card-title">
          <span>🤖</span> Automated Extraction &amp; Verification Badges
        </h2>
        <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
          ExamSetu uses PyMuPDF + Tesseract OCR and LLM rule extraction to parse official PDFs. Each extracted post includes an extraction confidence score:
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "0.85rem", fontWeight: 700 }}>
          <span className="badge-verified">✓ Verified (High Confidence)</span>
          <span className="badge-eligible">⚡ Auto Parsed</span>
          <span className="badge-ineligible">⏳ Pending Review</span>
        </div>
      </div>
    </div>
  );
}
