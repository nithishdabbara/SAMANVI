import React from "react";
import { AlertCircle, Search, ShieldOff, CheckCircle2, LayoutList, ShieldCheck } from "lucide-react";

const ProblemSolution = () => {
    return (
        <section id="problem-solution" className="section section--centered section--tight animate-fade-in">
            <div className="section-header" style={{ margin: '0 auto 20px' }}>
                <p className="section-kicker">Why Samanvi</p>
                <h2 className="section-title">A calmer way to coordinate</h2>
                <p className="section-subtitle">
                    Instead of one more noisy group, Samanvi gives your locality a clear board of problems, helpers and outcomes.
                </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>

                {/* Problems */}
                <div className="glass-card hover-lift" style={{ padding: '40px', background: 'rgba(230,57,70,0.06)' }}>
                    <h3 style={{ fontSize: '22px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '14px', color: '#b91c1c' }}>
                        <AlertCircle size={28} color="#e63946" /> Problems Today
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '16px' }}>
                            <Search size={24} color="#e63946" /> Hard to find local help
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '16px' }}>
                            <LayoutList size={24} color="#e63946" /> WhatsApp groups are messy
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '16px' }}>
                            <ShieldOff size={24} color="#e63946" /> No trust system
                        </li>
                    </ul>
                </div>

                {/* Solutions */}
                <div className="glass-card hover-lift animate-slide-up" style={{ padding: '40px', background: 'rgba(58,123,255,0.06)' }}>
                    <h3 style={{ fontSize: '22px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '14px', color: '#1d4ed8' }}>
                        <CheckCircle2 size={28} color="var(--accent)" /> Samanvi Solutions
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '16px' }}>
                            <ShieldCheck size={24} color="var(--accent)" /> Local verified users
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '16px' }}>
                            <LayoutList size={24} color="var(--accent)" /> Organized problem system
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '16px' }}>
                            <ShieldCheck size={24} color="var(--accent)" /> Trust based help
                        </li>
                    </ul>
                </div>
            </div>
        </section>
    );
};

export default ProblemSolution;
