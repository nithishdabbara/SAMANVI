import React from "react";
import Navbar from "../components/Navbar.jsx";
import Hero from "../components/Hero.jsx";
import WhySamanviExists from "../components/WhySamanviExists.jsx";
import ProblemSolution from "../components/ProblemSolution.jsx";
import Features from "../components/Features.jsx";
import HowItWorks from "../components/HowItWorks.jsx";
import AIFeatures from "../components/AIFeatures.jsx";
import AppPreview from "../components/AppPreview.jsx";
import About from "../components/About.jsx";
import Download from "../components/Download.jsx";
import WaitlistForm from "../components/WaitlistForm.jsx";
import Footer from "../components/Footer.jsx";

const App = () => {
  return (
    <div className="page-shell">
      <Navbar />
      <main className="main-content">
        <Hero />
        <WhySamanviExists />
        <ProblemSolution />
        <Features />
        <HowItWorks />
        <AIFeatures />
        <AppPreview />
        <About />
        <Download />
        <WaitlistForm />
      </main>
      <Footer />
    </div>
  );
};

export default App;
