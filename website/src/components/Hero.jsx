import React from "react";

const Hero = () => {
  return (
    <section id="home" className="section hero animate-fade-in">
      <div className="hero-left">
        <div
          className="animate-slide-up"
          style={{
            display: "inline-block",
            padding: "6px 14px",
            background: "rgba(58,123,255,0.1)",
            color: "var(--accent)",
            borderRadius: "20px",
            fontSize: "13px",
            fontWeight: "bold",
            letterSpacing: "0.05em",
            marginBottom: "30px",
            textTransform: "uppercase",
            border: "1px solid rgba(58,123,255,0.2)",
          }}
        >
          Now building for real neighbourhoods
        </div>
        <h1 className="hero-title">Samanvi</h1>
        <h2 className="hero-subtitle">
          Different people.<br />One coordinated flow.
        </h2>
        <p className="hero-description">
          Samanvi connects people within the same locality so everyday problems — from leaks and outages to lost items — get solved faster with trusted neighbours.
        </p>
        <div className="hero-actions">
          <button
            className="btn-primary hover-lift"
            style={{ padding: "14px 28px", fontSize: "16px" }}
            onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
          >
            Get early access
          </button>
          <button
            className="btn-ghost hover-lift"
            style={{ padding: "14px 28px", fontSize: "16px" }}
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
          >
            See how it works
          </button>
        </div>
        <div className="hero-benefits">
          <span className="hero-benefits-item">No noisy WhatsApp groups</span>
          <span className="hero-benefits-item">Only neighbours inside your locality</span>
        </div>
      </div>
      <div className="hero-right animate-slide-up" style={{ display: "flex", justifyContent: "center", position: "relative" }}>
        {/* Soft glow behind phone */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "250px",
            height: "500px",
            background: "var(--accent)",
            filter: "blur(80px)",
            opacity: "0.2",
            zIndex: 0,
            borderRadius: "50%",
          }}
        />
        <div
          className="hero-card glass-card hover-lift"
          style={{
            padding: 0,
            overflow: "hidden",
            borderRadius: "35px",
            border: "6px solid #fff",
            boxShadow: "0 30px 60px rgba(0,0,0,0.18)",
            zIndex: 1,
            position: "relative",
          }}
        >
          <img
            src="/hero_app_mockup.png"
            alt="Illustration of the Samanvi mobile app showing local issues, helpers and chat"
            className="hero-mockup-img"
            style={{ width: "100%", maxWidth: "300px", display: "block" }}
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;
