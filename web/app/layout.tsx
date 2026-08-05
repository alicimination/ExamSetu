import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://exam-setu-virid.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "ExamSetu — Sarkari Exam Eligibility & Government Job Tracker",
    template: "%s | ExamSetu",
  },
  description:
    "ExamSetu is India's leading automated government exam tracker. Check instant eligibility for UPSSSC, UP Police, SSC CGL, Sarkari Results, official PDF notices, and ask doubts with AI.",
  keywords: [
    "ExamSetu",
    "examsetu",
    "sarkari",
    "sarkari result",
    "government exams",
    "sarkari naukri",
    "UPSSSC eligibility",
    "UP Police bharti 2026",
    "SSC CGL qualification",
    "eligibility checker",
    "exam notification",
    "government job tracking",
    "examsetu bot",
  ],
  authors: [{ name: "ExamSetu Team" }],
  creator: "ExamSetu",
  publisher: "ExamSetu",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ExamSetu — Sarkari Exam Eligibility & Government Job Tracker",
    description: "Instant eligibility checking, latest Sarkari notifications, official PDFs, and AI doubt resolution for Indian government exams.",
    url: baseUrl,
    siteName: "ExamSetu",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ExamSetu — Sarkari Exam Eligibility & Government Job Tracker",
    description: "Check eligibility instantly for UPSSSC, UP Police, SSC CGL & Sarkari job notifications.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLdWebsite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ExamSetu",
  alternateName: ["examsetu", "Exam Setu", "ExamSetu Sarkari"],
  url: baseUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: `${baseUrl}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ExamSetu",
  url: baseUrl,
  logo: `${baseUrl}/favicon.ico`,
  sameAs: ["https://t.me/examsetu_bot"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }}
        />
      </head>
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
