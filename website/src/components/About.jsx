import React from "react";

const About = () => {
  return (
    <section id="about" className="section animate-fade-in">
      <div className="section-header">
        <p className="section-kicker">About</p>
        <h2 className="section-title">What is Samanvi?</h2>
        <p className="section-subtitle">
          Samanvi is building a calmer, locality-first way for neighbourhoods to coordinate real-world problems.
        </p>
      </div>
      <div className="about-grid">
        <p className="about-text">
          We focus on one simple idea: people who live near each other should be able to solve local issues together, without adding another loud social network. From broken street lights and water issues to missing items and quick local suggestions, Samanvi keeps everything limited to your own locality.
        </p>
        <div className="about-card glass-card hover-lift animate-slide-up">
          <h3 className="about-card-title">A focused local coordination board</h3>
          <p className="about-card-body">
            Not another global social network. Samanvi is a focused space where you can see what matters around your home, collaborate with trusted neighbours and close issues faster.
          </p>
          <div className="about-pills">
            <span className="pill">Location locked access</span>
            <span className="pill">Neighbour-first design</span>
            <span className="pill">Built for local communities</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
