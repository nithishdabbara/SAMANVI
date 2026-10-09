import React from "react";
import { TrendingUp, ShieldOff, BellOff, Sparkles } from "lucide-react";

const REASONS = [
    { title: "Local issues feel invisible", icon: <TrendingUp size={28} color="#e63946" />, text: "In big cities, small problems inside one building or layout rarely get coordinated properly." },
    { title: "Trust is hard to measure", icon: <ShieldOff size={28} color="#e63946" />, text: "It is difficult to know who is reliable in large WhatsApp groups or open forums." },
    { title: "Digital noise is exhausting", icon: <BellOff size={28} color="#e63946" />, text: "Important updates are buried under forwards, jokes and unrelated messages." },
    { title: "Samanvi brings a calm layer", icon: <Sparkles size={28} color="var(--accent)" />, text: "A focused space only for neighbourhood problems, helpers and resolutions." }
];

const WhySamanviExists = () => {
    return (
        <section id="why" className="section section--centered animate-fade-in">
            <div className="section-header" style={{ marginBottom: '40px' }}>
                <p className="section-kicker">The Mission</p>
                <h2 className="section-title">Why Samanvi exists</h2>
                <p className="section-subtitle">
                    We want neighbours to solve problems together without adding more chaos to their digital lives.
                </p>
            </div>
            <div className="features-grid">
                {REASONS.map((reason, i) => (
                    <div
                        key={reason.title}
                        className="glass-card hover-lift animate-slide-up"
                        style={{ padding: '30px 24px', textAlign: 'center', animationDelay: `${i * 0.1}s` }}
                    >
                        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>{reason.icon}</div>
                        <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>{reason.title}</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{reason.text}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default WhySamanviExists;
