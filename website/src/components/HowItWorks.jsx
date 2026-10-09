import React from "react";
import { UserPlus, MapPinned, Edit3, HeartHandshake } from "lucide-react";

const STEPS = [
  { step: "1", title: "Register Account", icon: <UserPlus size={32} /> },
  { step: "2", title: "Select Location", icon: <MapPinned size={32} /> },
  { step: "3", title: "Post Problem", icon: <Edit3 size={32} /> },
  { step: "4", title: "Get Help", icon: <HeartHandshake size={32} /> }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="section animate-fade-in" style={{ padding: '80px 20px', background: 'rgba(255,255,255,0.4)', borderRadius: '30px', margin: '40px 0' }}>
      <div className="section-header" style={{ textAlign: 'center', marginBottom: '60px' }}>
        <p className="section-kicker">How It Works</p>
        <h2 className="section-title">From problem to solution in four steps</h2>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', flexWrap: 'wrap', gap: '30px' }}>
        {/* Connecting Line */}
        <div style={{ position: 'absolute', top: '40px', left: '10%', right: '10%', height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', zIndex: 0 }} className="animate-fade-in" />

        {STEPS.map((s, i) => (
          <div key={s.step} className="hover-lift animate-slide-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flex: '1', minWidth: '150px', zIndex: 1, animationDelay: `${i * 0.15}s` }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#fff', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: '20px', boxShadow: '0 10px 25px rgba(58, 123, 255, 0.2)' }}>
              {s.icon}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Step {s.step}</span>
            <h3 style={{ fontSize: '18px', marginTop: '8px' }}>{s.title}</h3>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;
