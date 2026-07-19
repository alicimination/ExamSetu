"use client";

export default function NewsletterForm() {
  return (
    <form onSubmit={(e) => e.preventDefault()} className="newsletter-input-box">
      <input type="email" placeholder="email@example.com" />
      <button type="submit" className="newsletter-btn" title="Subscribe">
        ➤
      </button>
    </form>
  );
}
