import React, { useState } from "react";

const WaitlistForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [locality, setLocality] = useState("");
  const [status, setStatus] = useState({ type: null, message: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !locality.trim()) {
      setStatus({ type: "error", message: "Please fill your name, email and locality." });
      return;
    }
    setStatus({ type: "success", message: "Thank you. You’re on the early access list." });
    // Placeholder for wiring to a backend or external form service.
    // eslint-disable-next-line no-console
    console.log("Waitlist:", { name, email, locality });
  };

  return (
    <section id="waitlist" className="section section--tight">
      <div className="waitlist glass-card waitlist-card">
        <h3 className="waitlist-title">Join the waitlist</h3>
        <p className="waitlist-subtitle">
          Share a few details so we can invite you when Samanvi opens in your locality.
        </p>
        <form className="waitlist-form" onSubmit={handleSubmit}>
          <div className="waitlist-row">
            <input
              className="waitlist-input"
              type="text"
              name="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="waitlist-input"
              type="email"
              name="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <input
            className="waitlist-input"
            type="text"
            name="locality"
            placeholder="Apartment / layout / neighbourhood"
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
          />
          <div className="waitlist-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <button type="submit" className="btn-primary hover-lift" style={{ paddingInline: "22px" }}>
              Join early access
            </button>
            <p className="waitlist-helper">We’ll only use this to contact you about Samanvi.</p>
          </div>
          {status.type === "success" && <p className="waitlist-success">{status.message}</p>}
          {status.type === "error" && <p className="waitlist-error">{status.message}</p>}
        </form>
      </div>
    </section>
  );
};

export default WaitlistForm;

