import React from "react";
import { DownloadCloud, Smartphone, ArrowRight } from "lucide-react";

const Download = () => {
  return (
    <section id="download" className="section section--centered section--wide animate-fade-in">
      <div
        className="glass-card hover-lift animate-slide-up"
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.75), rgba(224,244,255,0.6))',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 30px 60px rgba(37,99,235,0.1)'
        }}
      >
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px' }}>
          <DownloadCloud size={40} color="var(--accent)" />
        </div>
        <h2 style={{ fontSize: '36px', marginBottom: '12px', letterSpacing: '-0.03em' }}>Join the early community</h2>
        <p style={{ fontSize: '18px', color: 'var(--text-muted)', marginBottom: '40px', maxWidth: '400px', lineHeight: '1.6' }}>
          Be among the first to experience Samanvi in your own locality. Early access spots are limited per area so we can learn carefully.
        </p>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>

          <button
            className="btn-primary hover-lift"
            style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '16px 32px', fontSize: '18px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(37,99,235,0.4)' }}
            onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
          >
            <Smartphone size={28} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.05em' }}>Coming soon</div>
              <div style={{ fontWeight: 'bold' }}>Get early access (Android)</div>
            </div>
            <ArrowRight size={20} style={{ marginLeft: '8px', opacity: 0.8 }} />
          </button>

          <button
            className="btn-primary hover-lift"
            style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '16px 32px', fontSize: '18px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(37,99,235,0.4)' }}
            onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
          >
            <Smartphone size={28} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.05em' }}>Coming later</div>
              <div style={{ fontWeight: 'bold' }}>iOS updates</div>
            </div>
            <ArrowRight size={20} style={{ marginLeft: '8px', opacity: 0.8 }} />
          </button>

        </div>
      </div>
    </section>
  );
};

export default Download;
