const { useState, useEffect, useRef } = React;

function FadeInSection({ children, delay = 0, className = "" }) {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(domRef.current);
        }
      });
    }, { threshold: 0.1 });
    
    const current = domRef.current;
    if (current) observer.observe(current);
    return () => { if (current) observer.unobserve(current); };
  }, []);

  return (
    <div
      className={`fade-in-section ${isVisible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
      ref={domRef}
    >
      {children}
    </div>
  );
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 80,
        behavior: "smooth"
      });
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-inner">
        <div className="logo">
          <div className="logo-icon">S</div>
          <span>Samanvi</span>
        </div>
        
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? "✕" : "☰"}
        </button>

        <div className={`nav-links ${menuOpen ? "open" : ""}`}>
          <button className="nav-link" onClick={() => scrollTo("features")}>Features</button>
          <button className="nav-link" onClick={() => scrollTo("how")}>How it Works</button>
          <button className="btn btn-primary" onClick={() => scrollTo("download")}>Get the app</button>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="section hero">
      <FadeInSection className="hero-content">
        <div className="section-label">Location-Based Platform</div>
        <h1 className="hero-title">Coordinate your community with precision.</h1>
        <p className="hero-subtitle">
          A calm, trusted space where neighbours help each other solve everyday issues, anchored to your true locality. More trust, less noise.
        </p>
        <div className="hero-ctas">
          <button className="btn btn-primary">
            Install on iOS
          </button>
          <button className="btn btn-secondary">
            Install on Android
          </button>
        </div>
      </FadeInSection>
      <FadeInSection delay={200} className="hero-visual">
        <div className="glass-card-lg">
          <div className="float-chip">Active Feed</div>
          <div style={{ flex: 1, background: 'var(--surface-container-low)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <div style={{ height: '24px', width: '40%', background: 'var(--surface-container)', borderRadius: '0.5rem' }}></div>
             <div style={{ height: '16px', width: '100%', background: 'var(--surface-container)', borderRadius: '0.5rem' }}></div>
             <div style={{ height: '16px', width: '80%', background: 'var(--surface-container)', borderRadius: '0.5rem' }}></div>
          </div>
          <div style={{ flex: 1, background: 'var(--surface-container-highest)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <div style={{ height: '24px', width: '30%', background: 'var(--surface-container)', borderRadius: '0.5rem' }}></div>
             <div style={{ height: '16px', width: '90%', background: 'var(--surface-container)', borderRadius: '0.5rem' }}></div>
          </div>
        </div>
      </FadeInSection>
    </section>
  );
}

function Features() {
  const featuresList = [
    {
      icon: "📍",
      title: "Location-Based Access",
      desc: "Connect instantly with verified people in your exact locality. No global feeds, just relevant nearby coordination."
    },
    {
      icon: "🤝",
      title: "Trust-Based System",
      desc: "Built on community profiles, helpfulness streaks, and neighbour endorsements to filter out the noise."
    },
    {
      icon: "✨",
      title: "AI Smart Suggestions",
      desc: "Intelligent matching directs your issues to the people most equipped to help, resolving problems faster."
    }
  ];

  return (
    <section id="features" className="section">
      <FadeInSection className="section-header">
        <div className="section-label">Features</div>
        <h2 className="section-title">Built for real-world coordination.</h2>
      </FadeInSection>
      <div className="features-grid">
        {featuresList.map((f, i) => (
          <FadeInSection key={i} delay={i * 150} className="feature-card">
            <div className="feature-icon-wrapper">{f.icon}</div>
            <h3 className="feature-title">{f.title}</h3>
            <p>{f.desc}</p>
          </FadeInSection>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { num: "01", title: "Join", desc: "Register and verify your location securely." },
    { num: "02", title: "Trust", desc: "Connect with real neighbours in your block." },
    { num: "03", title: "Coordinate", desc: "Post issues or offer help instantly." },
    { num: "04", title: "Thrive", desc: "Resolve local problems together as one community." }
  ];

  return (
    <div id="how" className="how-section">
      <FadeInSection className="section-header">
        <div className="section-label">Process</div>
        <h2 className="section-title">A unified flow in four steps.</h2>
      </FadeInSection>
      <div className="how-grid">
        {steps.map((st, i) => (
          <FadeInSection key={i} delay={i * 150} className="how-step">
            <div className="step-number">{st.num}</div>
            <div>
              <div className="step-title">{st.title}</div>
              <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>{st.desc}</p>
            </div>
          </FadeInSection>
        ))}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer id="download" className="cta-footer">
      <FadeInSection>
        <h2 className="section-title">Ready to connect?</h2>
        <p style={{ maxWidth: '400px', margin: '0 auto', marginTop: '1rem' }}>
          Download the Samanvi app today and turn your neighbourhood into a coordinated support network.
        </p>
        <div className="hero-ctas" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
          <button className="btn btn-primary">Download App</button>
        </div>
        <div className="footer-meta">
          © 2026 Samanvi. All rights reserved.
        </div>
      </FadeInSection>
    </footer>
  );
}

function App() {
  return (
    <div className="page-shell">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Footer />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
