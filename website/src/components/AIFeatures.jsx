import React from "react";
import { Brain, Users, AlertTriangle, ShieldAlert } from "lucide-react";

const AI_FEATURES = [
    { title: "Problem categorisation", icon: <Brain size={32} />, text: "Automatically groups similar issues so patterns in your locality are visible." },
    { title: "Helper recommendation", icon: <Users size={32} />, text: "Suggests neighbours who have helped before or are close to the issue." },
    { title: "Priority detection", icon: <AlertTriangle size={32} />, text: "Surfaces urgent water, safety or access problems first." },
    { title: "Trust prediction", icon: <ShieldAlert size={32} />, text: "Uses past behaviour to keep unreliable helpers away from critical tasks." }
];

const AIFeatures = () => {
    return (
        <section
            id="ai-features"
            className="section section--centered animate-fade-in"
            style={{ borderTop: '1px solid rgba(148, 163, 184, 0.2)', background: 'linear-gradient(to bottom, #F7F9FC, rgba(224, 244, 255, 0.2))' }}
        >
            <div className="section-header" style={{ margin: '0 auto 40px' }}>
                <p className="section-kicker" style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Powered by intelligent systems</p>
                <h2 className="section-title">Smart community coordination</h2>
                <p className="section-subtitle">
                    AI helps Samanvi stay organised and fair, while final decisions always stay with your community.
                </p>
            </div>
            <div className="features-grid">
                {AI_FEATURES.map((feat, index) => (
                    <div key={feat.title} className="glass-card hover-lift animate-slide-up" style={{ padding: '36px 20px', textAlign: 'center', animationDelay: `${index * 0.1}s`, background: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ color: 'var(--accent)', marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                            {feat.icon}
                        </div>
                        <h3 style={{ fontSize: '18px', marginBottom: '12px', fontWeight: '600' }}>{feat.title}</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.6' }}>{feat.text}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default AIFeatures;
