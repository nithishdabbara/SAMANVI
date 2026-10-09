import React, { useEffect, useMemo, useState } from "react";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { id: "home", label: "Home" },
      { id: "features", label: "Features" },
      { id: "how-it-works", label: "How It Works" },
      { id: "about", label: "About" },
      { id: "waitlist", label: "Early access" },
    ],
    []
  );

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      const sections = navItems.map((n) => n.id);
      for (const section of [...sections].reverse()) {
        const el = document.getElementById(section);
        if (el && window.scrollY >= el.offsetTop - 150) {
          setActive(section);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navItems]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    if (menuOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className={`navbar ${scrolled ? "is-scrolled" : ""}`}>
      <div className="nav-inner">
        <div className="nav-logo hover-lift" style={{ cursor: "pointer" }} onClick={() => scrollTo("home")}>
          <div className="logo-mark" style={{ background: "var(--accent)", color: "#fff" }}>
            S
          </div>
          <span className="logo-text" style={{ fontSize: "1.2rem" }}>
            Samanvi
          </span>
        </div>
        <nav className="nav-links">
          {navItems.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className={`nav-link ${active === n.id ? "is-active" : ""}`}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <button className="btn-primary hover-lift" onClick={() => scrollTo("waitlist")}>
            Get early access
          </button>
          <button
            type="button"
            className="nav-icon-btn"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-nav-overlay" role="dialog" aria-modal="true" onMouseDown={() => setMenuOpen(false)}>
          <div className="mobile-nav-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mobile-nav-header">
              <div className="mobile-nav-title" onClick={() => scrollTo("home")} style={{ cursor: "pointer" }}>
                <div className="logo-mark" style={{ background: "var(--accent)", color: "#fff" }}>
                  S
                </div>
                <span>Samanvi</span>
              </div>
              <button type="button" className="nav-icon-btn" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="mobile-nav-links">
              {navItems.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`mobile-nav-link ${active === n.id ? "is-active" : ""}`}
                  onClick={() => scrollTo(n.id)}
                >
                  {n.label}
                </button>
              ))}
            </div>
            <div className="mobile-nav-cta">
              <button type="button" className="btn-primary hover-lift" onClick={() => scrollTo("waitlist")}>
                Get early access
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
