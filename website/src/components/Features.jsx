import React from "react";
import { MapPin, RefreshCw, Brain, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    title: "Location Based Access",
    description: "Only people from the same locality can connect.",
    icon: <MapPin size={36} color="var(--accent)" />
  },
  {
    title: "Problem Exchange",
    description: "Post problems and get help from nearby people.",
    icon: <RefreshCw size={36} color="var(--accent)" />
  },
  {
    title: "AI Smart Suggestions",
    description: "Smart helper recommendations.",
    icon: <Brain size={36} color="var(--accent)" />
  },
  {
    title: "Trust Score System",
    description: "Reliable local helpers.",
    icon: <ShieldCheck size={36} color="var(--accent)" />
  }
];

const Features = () => {
  return (
    <section id="features" className="section section--centered animate-fade-in">
      <div className="section-header" style={{ marginBottom: '40px' }}>
        <p className="section-kicker">Features</p>
        <h2 className="section-title">Built for real neighbourhoods</h2>
        <p className="section-subtitle">
          Everything in Samanvi is designed for people who actually live near each other, not the whole internet.
        </p>
      </div>
      <div className="features-grid">
        {FEATURES.map((feat, i) => (
          <div
            key={feat.title}
            className="glass-card hover-lift animate-slide-up"
            style={{ padding: '32px 24px', textAlign: 'center', animationDelay: `${i * 0.1}s` }}
          >
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>{feat.icon}</div>
            <h3 style={{ fontSize: '18px', marginBottom: '10px', fontWeight: 600 }}>{feat.title}</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', opacity: 0.9, lineHeight: '1.6' }}>{feat.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Features;
