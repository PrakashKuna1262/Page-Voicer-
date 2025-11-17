import React from "react";
import { Link } from "react-router-dom";
import "./Home.css";

export default function Home() {
  const handleLearnMoreClick = (e) => {
    e.preventDefault();
    const element = document.getElementById("how-it-works");
    if (element) {
      const offset = 80; // Offset for fixed headers if any
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - offset;

      // Use requestAnimationFrame for smoother animation
      const startPosition = window.pageYOffset;
      const distance = offsetPosition - startPosition;
      const duration = 800; // Animation duration in milliseconds
      let start = null;

      const step = (timestamp) => {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        const percentage = Math.min(progress / duration, 1);
        
        // Easing function for smooth animation (ease-in-out)
        const ease = percentage < 0.5
          ? 2 * percentage * percentage
          : 1 - Math.pow(-2 * percentage + 2, 2) / 2;

        window.scrollTo(0, startPosition + distance * ease);

        if (progress < duration) {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);
    }
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <div className="home-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-icon">🎙️</span>
            <span>Page Voicer</span>
          </div>
          <h1 className="hero-title">
            Transform Documents into
            <span className="gradient-text"> Voice</span>
          </h1>
          <p className="hero-subtitle">
            Extract text from PDFs and images, translate to any language, and convert to speech instantly. 
            <br />
            <strong>100% Free • No Registration • Works in Your Browser</strong>
          </p>
          <div className="hero-buttons">
            <Link to="/extract" className="cta-button primary">
              <span className="button-icon">🚀</span>
              Get Started Free
            </Link>
            <a 
              href="#how-it-works" 
              className="cta-button secondary"
              onClick={handleLearnMoreClick}
            >
              <span className="button-icon">📖</span>
              Learn More
            </a>
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">100%</div>
              <div className="stat-label">Free</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">50+</div>
              <div className="stat-label">Languages</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">⚡</div>
              <div className="stat-label">Instant</div>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-card card-1">
            <div className="card-icon">📄</div>
            <div className="card-text">PDF</div>
          </div>
          <div className="floating-card card-2">
            <div className="card-icon">🔍</div>
            <div className="card-text">OCR</div>
          </div>
          <div className="floating-card card-3">
            <div className="card-icon">🌐</div>
            <div className="card-text">Translate</div>
          </div>
          <div className="floating-card card-4">
            <div className="card-icon">🔊</div>
            <div className="card-text">Voice</div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="section-header">
          <h2 className="section-title">
            How <span className="gradient-text">Page Voicer</span> Works
          </h2>
          <p className="section-subtitle">
            Follow the roadmap to transform your documents into voice
          </p>
        </div>
        <div className="roadmap-container">
          {/* Desktop Horizontal Roadmap */}
          <div className="roadmap-horizontal">
            <div className="roadmap-step-horizontal">
              <div className="step-icon-small">📤</div>
              <div className="step-number-small">1</div>
              <h3>Upload</h3>
              <p>Choose PDF or image</p>
            </div>

            <div className="roadmap-arrow-small">→</div>

            <div className="roadmap-step-horizontal">
              <div className="step-icon-small">👁️</div>
              <div className="step-number-small">2</div>
              <h3>View</h3>
              <p>Preview document</p>
            </div>

            <div className="roadmap-arrow-small">→</div>

            <div className="roadmap-step-horizontal">
              <div className="step-icon-small">🔍</div>
              <div className="step-number-small">3</div>
              <h3>Extract</h3>
              <p>OCR processing</p>
            </div>

            <div className="roadmap-arrow-small">→</div>

            <div className="roadmap-step-horizontal">
              <div className="step-icon-small">🌐</div>
              <div className="step-number-small">4</div>
              <h3>Translate</h3>
              <p>Auto-translate</p>
            </div>

            <div className="roadmap-arrow-small">→</div>

            <div className="roadmap-step-horizontal">
              <div className="step-icon-small">🔊</div>
              <div className="step-number-small">5</div>
              <h3>Speak</h3>
              <p>Text-to-speech</p>
            </div>
          </div>

          {/* Mobile Vertical Roadmap */}
          <div className="roadmap-vertical">
            <div className="roadmap-step-vertical">
              <div className="step-icon-small-vertical">📤</div>
              <div className="step-number-small-vertical">1</div>
              <div className="step-content-vertical">
                <h3>Upload</h3>
                <p>Choose a PDF file or image from your device. Drag and drop or click to browse.</p>
              </div>
            </div>

            <div className="roadmap-step-vertical">
              <div className="step-icon-small-vertical">👁️</div>
              <div className="step-number-small-vertical">2</div>
              <div className="step-content-vertical">
                <h3>View</h3>
                <p>Preview your document or image in the viewer. Navigate through PDF pages easily.</p>
              </div>
            </div>

            <div className="roadmap-step-vertical">
              <div className="step-icon-small-vertical">🔍</div>
              <div className="step-number-small-vertical">3</div>
              <div className="step-content-vertical">
                <h3>Extract</h3>
                <p>Click "Extract Text" to perform OCR and get text from the image or PDF page.</p>
              </div>
            </div>

            <div className="roadmap-step-vertical">
              <div className="step-icon-small-vertical">🌐</div>
              <div className="step-number-small-vertical">4</div>
              <div className="step-content-vertical">
                <h3>Translate</h3>
                <p>Select a target language from the dropdown. Translation happens automatically!</p>
              </div>
            </div>

            <div className="roadmap-step-vertical">
              <div className="step-icon-small-vertical">🔊</div>
              <div className="step-number-small-vertical">5</div>
              <div className="step-content-vertical">
                <h3>Speak</h3>
                <p>Listen to the text using text-to-speech. Adjust speed, voice, and download audio.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="use-cases-section">
        <div className="section-header">
          <h2 className="section-title">
            Perfect For <span className="gradient-text">Everyone</span>
          </h2>
        </div>
        <div className="use-cases-grid">
          <div className="use-case-card">
            <div className="use-case-icon">👨‍🎓</div>
            <h3>Students</h3>
            <p>Extract text from study materials, translate research papers, and listen to content while multitasking.</p>
          </div>
          <div className="use-case-card">
            <div className="use-case-icon">💼</div>
            <h3>Professionals</h3>
            <p>Convert documents to speech for hands-free reading, translate business documents, and process scanned files.</p>
          </div>
          <div className="use-case-card">
            <div className="use-case-icon">🌍</div>
            <h3>Language Learners</h3>
            <p>Practice pronunciation, translate content to your native language, and improve listening skills.</p>
          </div>
          <div className="use-case-card">
            <div className="use-case-icon">♿</div>
            <h3>Accessibility</h3>
            <p>Make documents accessible with text-to-speech, extract text from images, and translate content.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Transform Your Documents?</h2>
          <p>Start extracting, translating, and voicing your documents now - completely free!</p>
          <Link to="/extract" className="cta-button large">
            <span className="button-icon">🚀</span>
            Get Started Free
            <span className="button-arrow">→</span>
          </Link>
          <div className="cta-features">
            <div className="cta-feature">✓ No Registration Required</div>
            <div className="cta-feature">✓ 100% Free Forever</div>
            <div className="cta-feature">✓ Works in Your Browser</div>
          </div>
        </div>
      </section>
    </div>
  );
}
