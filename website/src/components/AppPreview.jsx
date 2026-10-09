import React from "react";
import { LogIn, Home, PlusCircle, MessageSquare } from "lucide-react";

const AppPreview = () => {
  return (
    <section id="app-preview" className="section section--centered animate-fade-in">
      <div className="section-header" style={{ marginBottom: '50px' }}>
        <p className="section-kicker">App Preview</p>
        <h2 className="section-title">A glimpse of the mobile app</h2>
        <p className="section-subtitle">
          From login to posting a problem and coordinating in chat, Samanvi keeps each step simple and local.
        </p>
      </div>
      <div className="phones-row" style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', perspective: '1000px' }}>

        {/* Screen 1: Login */}
        <div className="phone-frame hover-lift animate-slide-up" style={{ animationDelay: '0s', boxShadow: '0 30px 60px rgba(0,0,0,0.18)', transform: 'rotateY(5deg) rotateX(2deg) rotateZ(-1deg)' }}>
          <div className="phone-reflection" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 52%)', zIndex: 10, pointerEvents: 'none', borderRadius: '30px' }} />
          <div className="phone-inner">
            <div className="phone-notch" />
            <div className="phone-header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><LogIn size={14} /> Login</div>
            <div className="phone-block primary">Enter phone number</div>
            <div className="phone-block muted" style={{ minHeight: '60px' }}>Get simple OTP access</div>
            <div className="phone-footer" style={{ marginTop: 'auto' }}>Secure & fast.</div>
          </div>
        </div>

        {/* Screen 2: Home */}
        <div className="phone-frame hover-lift animate-slide-up" style={{ animationDelay: '0.15s', boxShadow: '0 30px 60px rgba(0,0,0,0.18)', transform: 'rotateY(2deg) rotateX(2deg) rotateZ(1deg)' }}>
          <div className="phone-reflection" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 52%)', zIndex: 10, pointerEvents: 'none', borderRadius: '30px' }} />
          <div className="phone-inner">
            <div className="phone-notch" />
            <div className="phone-header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Home size={14} /> Home</div>
            <div className="phone-block primary">Local issues feed</div>
            <div className="phone-block muted">• Water leak reported</div>
            <div className="phone-block muted" style={{ minHeight: '30px' }}>• Lost pet spotted</div>
            <div className="phone-chip">Interactive map</div>
          </div>
        </div>

        {/* Screen 3: Post Problem */}
        <div className="phone-frame hover-lift animate-slide-up" style={{ animationDelay: '0.3s', boxShadow: '0 30px 60px rgba(0,0,0,0.18)', transform: 'rotateY(-2deg) rotateX(2deg) rotateZ(-1deg)' }}>
          <div className="phone-reflection" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 52%)', zIndex: 10, pointerEvents: 'none', borderRadius: '30px' }} />
          <div className="phone-inner">
            <div className="phone-notch" />
            <div className="phone-header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><PlusCircle size={14} /> Post Problem</div>
            <div className="phone-block primary">Add Title & Photo</div>
            <div className="phone-chip alt" style={{ marginBottom: '8px' }}>Auto location tag</div>
            <div className="phone-block muted" style={{ minHeight: '40px' }}>AI categorization</div>
            <div className="phone-footer" style={{ marginTop: 'auto' }}>Post locally.</div>
          </div>
        </div>

        {/* Screen 4: Chat */}
        <div className="phone-frame hover-lift animate-slide-up" style={{ animationDelay: '0.45s', boxShadow: '0 30px 60px rgba(0,0,0,0.18)', transform: 'rotateY(-5deg) rotateX(2deg) rotateZ(1deg)' }}>
          <div className="phone-reflection" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 52%)', zIndex: 10, pointerEvents: 'none', borderRadius: '30px' }} />
          <div className="phone-inner">
            <div className="phone-notch" />
            <div className="phone-header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MessageSquare size={14} /> Chat</div>
            <div className="phone-block muted" style={{ alignSelf: 'flex-start', background: '#f1f5f9' }}>I can help fix this!</div>
            <div className="phone-block primary" style={{ alignSelf: 'flex-end', background: 'var(--accent)', color: '#fff', textAlign: 'right' }}>Thanks, meet at gate?</div>
            <div className="phone-footer" style={{ marginTop: 'auto' }}>End-to-end coordinated.</div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default AppPreview;
