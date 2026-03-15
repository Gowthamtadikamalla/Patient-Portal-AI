import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="landing-container">
      {/* Header */}
      <header className="landing-header">
        <div className="logo">
          <div className="logo-icon">🏥</div>
          <span>Kyron Medical</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <span className="pulse-dot" />
          AI-Powered Patient Portal
        </div>

        <h1 className="hero-title">
          Your Health,{' '}
          <span className="gradient-text">Simplified</span>
        </h1>

        <p className="hero-subtitle">
          Schedule appointments, check prescriptions, and get answers instantly
          with our intelligent AI assistant. Available 24/7 for your convenience.
        </p>

        <Link href="/chat" className="hero-cta">
          Start a Conversation
          <span className="arrow">→</span>
        </Link>
      </section>

      {/* Feature Cards */}
      <div className="features-grid">
        <div className="glass-panel feature-card">
          <div className="feature-icon">📅</div>
          <h3>Smart Scheduling</h3>
          <p>
            Tell us what you need and our AI matches you with the right specialist,
            then finds times that work for you.
          </p>
        </div>

        <div className="glass-panel feature-card">
          <div className="feature-icon">📞</div>
          <h3>Voice AI Handoff</h3>
          <p>
            Prefer to talk? Switch to a phone call anytime and our AI continues
            the conversation seamlessly.
          </p>
        </div>

        <div className="glass-panel feature-card">
          <div className="feature-icon">💊</div>
          <h3>Prescription Refills</h3>
          <p>
            Check the status of your prescription refills instantly without
            waiting on hold.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        © {new Date().getFullYear()} Kyron Medical Partners. All rights reserved. · HIPAA Compliant
      </footer>
    </div>
  );
}
