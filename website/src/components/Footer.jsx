import React from "react";

const Footer = () => {
  const handlePlaceholderClick = (e) => {
    e.preventDefault();
  };

  return (
    <footer className="footer" style={{ padding: '80px 40px 40px', background: '#0f172a', color: '#f8fafc', borderTop: 'none' }}>
      <div className="footer-inner" style={{ maxWidth: '1120px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '60px' }}>

        {/* Brand */}
        <div>
          <h2 style={{ fontSize: '28px', margin: '0 0 16px', color: '#fff', letterSpacing: '-0.03em' }}>Samanvi</h2>
          <p style={{ color: '#94a3b8', fontSize: '15px', margin: '0 0 24px', lineHeight: '1.6' }}>
            A purpose-built layer for local action and problem solving.
          </p>
        </div>

        {/* Product Columns */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ color: '#fff', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Product</h4>
          <a href="#features" className="footer-link" style={{ color: '#94a3b8' }}>Features</a>
          <a href="#how-it-works" className="footer-link" style={{ color: '#94a3b8' }}>How it Works</a>
          <a href="#ai-features" className="footer-link" style={{ color: '#94a3b8' }}>Intelligent Systems</a>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ color: '#fff', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Company</h4>
          <a href="#about" className="footer-link" style={{ color: '#94a3b8' }}>About Us</a>
          <a href="#why" className="footer-link" style={{ color: '#94a3b8' }}>The Mission</a>
          <a href="#" className="footer-link" style={{ color: '#94a3b8' }} onClick={handlePlaceholderClick}>Careers</a>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ color: '#fff', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Legal</h4>
          <a href="#" className="footer-link" style={{ color: '#94a3b8' }} onClick={handlePlaceholderClick}>Privacy Policy</a>
          <a href="#" className="footer-link" style={{ color: '#94a3b8' }} onClick={handlePlaceholderClick}>Terms of Service</a>
          <a href="#" className="footer-link" style={{ color: '#94a3b8' }} onClick={handlePlaceholderClick}>Contact</a>
        </div>

      </div>
      <div style={{ maxWidth: '1120px', margin: '60px auto 0', paddingTop: '30px', borderTop: '1px solid rgba(148,163,184,0.2)', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
        © 2026 Samanvi. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
