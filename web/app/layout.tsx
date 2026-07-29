import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExamSetu — Sarkari Exam Eligibility & Doubt Assistant",
  description:
    "Track UPSSSC, UP Police, SSC CGL notifications. Check eligibility instantly. Ask doubts via AI chat with source citations. Free alerts on Telegram.",
  keywords: [
    "sarkari exam", "government job", "UPSSSC", "UP Police", "SSC CGL",
    "eligibility checker", "exam notification", "sarkari result",
  ],
  openGraph: {
    title: "ExamSetu — Your Sarkari Exam Assistant",
    description: "Check eligibility, track notifications, ask doubts — all free.",
    type: "website",
    locale: "en_IN",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="page-wrapper">
          {/* ── Navbar ── */}
          <nav className="navbar">
            <div className="navbar-inner">
              <a href="/" className="navbar-brand">
                <span>Exam</span><span className="logo-blue">Setu</span>
              </a>
              <ul className="navbar-links">
                <li><a href="/" className="active">Exams</a></li>
                <li><a href="/#notifications">Notifications</a></li>
                <li><a href="/faq">FAQs</a></li>
                <li><a href="https://t.me/examsetu_bot" target="_blank" rel="noopener">Telegram Bot</a></li>
              </ul>
            </div>
          </nav>

          {/* ── Main Content ── */}
          <main style={{ flex: 1 }}>{children}</main>

          {/* ── Dark Footer ── */}
          <footer className="footer-dark">
            <div className="container">
              <div className="footer-grid">
                <div>
                  <div className="footer-brand">
                    <span>Exam</span><span style={{ color: "#2563EB" }}>Setu</span>
                  </div>
                  <p className="footer-desc">
                    Empowering Aspirants through Precision. Your one-stop shop for tracking India&apos;s competitive landscape.
                  </p>
                </div>

                <div>
                  <div className="footer-col-title">COMPANY</div>
                  <ul className="footer-links">
                    <li><a href="/privacy">Privacy Policy</a></li>
                    <li><a href="/terms">Terms of Service</a></li>
                    <li><a href="/disclaimer">Disclaimer</a></li>
                  </ul>
                </div>

                <div>
                  <div className="footer-col-title">SUPPORT</div>
                  <ul className="footer-links">
                    <li><a href="/faq">Help Center &amp; FAQs</a></li>
                    <li><a href="/sources">Official Data Sources</a></li>
                    <li><a href="https://t.me/examsetu_bot" target="_blank" rel="noopener">Telegram Alerts</a></li>
                  </ul>
                </div>
              </div>

              <div className="footer-bottom">
                © 2026 ExamSetu. Empowering Aspirants through Precision. All rights reserved.
              </div>
            </div>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
