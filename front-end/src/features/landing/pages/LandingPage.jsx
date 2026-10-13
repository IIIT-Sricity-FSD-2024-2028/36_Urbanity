import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../../constants/routes.js";
import "../landing.css";

const iconPaths = {
  building: ["M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"],
  location: ["M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z", "M15 11a3 3 0 11-6 0 3 3 0 016 0z"],
  bell: ["M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"],
  chart: ["M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"],
  arrow: ["M13 7l5 5m0 0l-5 5m5-5H6"],
  check: ["M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"],
  users: ["M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"],
  bolt: ["M13 10V3L4 14h7v7l9-11h-7z"],
  shield: ["M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"],
  trend: ["M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"],
  globe: ["M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"],
  chat: ["M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"],
  search: ["M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"],
  user: ["M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"],
  phone: ["M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"],
  eye: ["M15 12a3 3 0 11-6 0 3 3 0 016 0z", "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"],
  group: ["M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"],
  clock: ["M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"],
  mail: ["M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"],
  telephone: ["M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498A1 1 0 0121 15.72V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"],
};

function Icon({ name, className, color }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke={color || "currentColor"} strokeWidth="2" aria-hidden="true">
    {iconPaths[name].map((path) => <path key={path} strokeLinecap="round" strokeLinejoin="round" d={path} />)}
  </svg>;
}

const heroCards = [
  ["location", "Location Tracking", "#3B9EFF"],
  ["bell", "Real-time Updates", "#4CAF50"],
  ["chart", "Analytics Dashboard", "#FF9800"],
  ["arrow", "Quick Resolution", "#9C27B0"],
];

const features = [
  ["check", "Easy Issue Reporting", "Residents can report apartment, tower, and community issues with supporting photos.", "#3B9EFF", "rgba(59, 158, 255, 0.08)"],
  ["users", "Resident Visibility", "Keep residents informed from complaint submission through maintenance resolution.", "#4CAF50", "rgba(76, 175, 80, 0.08)"],
  ["bolt", "Fast Resolution", "Community administrators route work to the right maintenance workforce quickly.", "#FF9800", "rgba(255, 152, 0, 0.08)"],
  ["shield", "Accountability & Tracking", "Track every complaint from submission to resolution with complete transparency.", "#9C27B0", "rgba(156, 39, 176, 0.08)"],
  ["trend", "Data-Driven Insights", "Analytics dashboard provides actionable insights for improved service delivery.", "#E91E63", "rgba(233, 30, 99, 0.08)"],
  ["globe", "Community Structure", "Organize operations around communities, towers, floors, apartments, and the people who use them.", "#00BCD4", "rgba(0, 188, 212, 0.08)"],
];

const stats = [
  ["50K+", "Complaints Tracked", "+15%"],
  ["42K+", "Complaints Resolved", "+22%"],
  ["84%", "Resolution Rate", "+8%"],
  ["2.5 days", "Avg. Resolution Time", "-12%"],
];

const steps = [
  ["1", "chat", "Report", "Residents report apartment, tower, or community complaints with supporting images.", "#3B9EFF", "rgba(59, 158, 255, 0.08)"],
  ["2", "search", "Review", "The correct community authority reviews and routes each complaint.", "#9C27B0", "rgba(156, 39, 176, 0.08)"],
  ["3", "user", "Assign", "Community authorities assign qualified maintenance workers.", "#FF9800", "rgba(255, 152, 0, 0.08)"],
  ["4", "check", "Resolve", "Workers resolve issues and residents can follow every status update.", "#4CAF50", "rgba(76, 175, 80, 0.08)"],
];

const residentFeatures = [
  "Report apartment and shared-space concerns",
  "Upload photos and detailed descriptions",
  "Track complaint status in real-time",
  "Receive notifications on progress",
  "See updates for community complaints",
  "Rate service quality and provide feedback",
];

const operationsFeatures = [
  "Centralized dashboard for all complaints",
  "Automated categorization and routing",
  "Assign tasks to departments and teams",
  "Set priorities and track resolution time",
  "Generate reports and analytics",
  "Monitor KPIs and performance metrics",
];

const benefits = [
  ["eye", "Transparent Administration", "Build trust through visible accountability and clear communication."],
  ["trend", "Improved Service Delivery", "Faster response times and higher resolution rates for better resident satisfaction."],
  ["group", "Resident Engagement", "Give residents a clear way to report concerns and follow their resolution."],
  ["building", "Centralized Monitoring", "One platform for oversight of community complaints and maintenance work."],
  ["location", "Location Intelligence", "Identify recurring shared-space concerns and allocate maintenance resources effectively."],
  ["clock", "Efficiency & Accountability", "Track performance metrics and ensure timely resolution of community complaints."],
];

function SocialIcon({ type }) {
  const paths = {
    facebook: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    twitter: "M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z",
    linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
    instagram: "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 5.838A6.162 6.162 0 1012 18.162 6.162 6.162 0 0012 5.838zm0 10.162a4 4 0 110-8 4 4 0 010 8zm7.846-10.405a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z",
  };
  return <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[type]} /></svg>;
}

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollToSection = (event, selector) => {
    event.preventDefault();
    setMobileOpen(false);
    const target = document.querySelector(selector);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const sectionLink = (href, label) => <a href={href} onClick={(event) => scrollToSection(event, href)}>{label}</a>;

  return <main className="landing-page">
    <nav className="landing-nav" aria-label="Main navigation">
      <div className="landing-container landing-nav__container">
        <Link className="landing-logo" to={ROUTES.HOME} onClick={() => setMobileOpen(false)}>
          <span className="landing-logo__icon"><Icon name="building" /></span>
          <span className="landing-logo__text">Urbanity</span>
        </Link>
        <ul className="landing-nav__links">
          <li>{sectionLink("#features", "Features")}</li>
          <li>{sectionLink("#how-it-works", "How It Works")}</li>
          <li>{sectionLink("#about", "Benefits")}</li>
          <li>{sectionLink("#benefits", "About")}</li>
          <li>{sectionLink("#contact", "Contact")}</li>
        </ul>
        <div className="landing-nav__buttons">
          <Link className="landing-btn landing-btn--ghost" to={ROUTES.LOGIN}>Sign In</Link>
          <Link className="landing-btn landing-btn--primary" to={ROUTES.LOGIN}>Get Started</Link>
        </div>
        <button className="landing-nav__menu" type="button" aria-label="Toggle navigation" aria-expanded={mobileOpen} aria-controls="landing-mobile-navigation" onClick={() => setMobileOpen((current) => !current)}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
        </button>
      </div>
      <div id="landing-mobile-navigation" className={`landing-nav__mobile${mobileOpen ? " landing-nav__mobile--open" : ""}`}>
        {sectionLink("#features", "Features")}
        {sectionLink("#how-it-works", "How It Works")}
        {sectionLink("#about", "Benefits")}
        {sectionLink("#benefits", "About")}
        {sectionLink("#contact", "Contact")}
        <Link to={ROUTES.LOGIN} onClick={() => setMobileOpen(false)}>Sign In</Link>
        <Link className="landing-btn landing-btn--primary" to={ROUTES.LOGIN} onClick={() => setMobileOpen(false)}>Get Started</Link>
      </div>
    </nav>

    <section className="landing-hero">
      <div className="landing-hero__background"><img src="https://images.unsplash.com/photo-1747499967281-c0c5eec9933c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjaXR5JTIwc2t5bGluZSUyMHNtYXJ0fGVufDF8fHx8MTc3MjkwMzg0M3ww&ixlib=rb-4.1.0&q=80&w=1080" alt="Modern city skyline" /><div /></div>
      <div className="landing-container landing-hero__content">
        <div className="landing-hero__grid">
          <div className="landing-hero__text">
            <h1><span>Urbanity</span></h1>
            <p className="landing-hero__subtitle">Community operations made clear, connected, and accountable</p>
            <p className="landing-hero__description">A shared workspace for communities, towers, apartments, residents, and maintenance teams to track every complaint through transparent resolution.</p>
            <div className="landing-hero__buttons">
              <Link className="landing-btn landing-btn--primary landing-btn--large" to={ROUTES.LOGIN}>Get Started <span aria-hidden="true">→</span></Link>
              <a className="landing-btn landing-btn--outline landing-btn--large" href="#features" onClick={(event) => scrollToSection(event, "#features")}>Learn More</a>
            </div>
          </div>
          <div className="landing-hero__cards">
            {heroCards.map(([icon, label, color]) => <article className="landing-hero-card" key={label}><Icon name={icon} color={color} /><p>{label}</p></article>)}
          </div>
        </div>
      </div>
    </section>

    <section id="features" className="landing-section landing-features">
      <div className="landing-container">
        <header className="landing-section__header"><h2>Everything a community needs to resolve issues well</h2><p>Purpose-built tools for community administration, maintenance coordination, and resident visibility.</p></header>
        <div className="landing-features__grid">
          {features.map(([icon, title, description, color, background]) => <article className="landing-feature-card" key={title}><span className="landing-feature-card__icon" style={{ backgroundColor: background }}><Icon name={icon} color={color} /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </div>
    </section>

    <section id="stats" className="landing-section landing-stats">
      <div className="landing-stats__decoration"><span /><span /></div>
      <div className="landing-container">
        <header className="landing-section__header"><h2>Making a Real Impact</h2><p>A clearer way to manage issues across every community</p></header>
        <div className="landing-stats__grid">
          {stats.map(([value, label, change]) => <article className="landing-stat-card" key={label}><strong>{value}</strong><p>{label}</p><span><Icon name="trend" />{change}</span></article>)}
        </div>
      </div>
    </section>

    <section id="how-it-works" className="landing-section landing-workflow">
      <div className="landing-container">
        <header className="landing-section__header"><h2>How It Works</h2><p>A streamlined four-step process from issue reporting to resolution</p></header>
        <div className="landing-workflow__container"><div className="landing-workflow__line" /><div className="landing-workflow__grid">
          {steps.map(([number, icon, title, description, color, background]) => <article className="landing-step-card" key={number}><div><span className="landing-step-card__number" style={{ backgroundColor: color }}>{number}</span><span className="landing-step-card__icon" style={{ backgroundColor: background }}><Icon name={icon} color={color} /></span><h3>{title}</h3><p>{description}</p></div></article>)}
        </div></div>
      </div>
    </section>

    <section id="about" className="landing-section landing-users">
      <div className="landing-container">
        <header className="landing-section__header"><h2>Built for Everyone</h2><p>Purpose-built experiences for residents and community operations teams</p></header>
        <div className="landing-user-block">
          <div className="landing-user-block__grid">
            <div className="landing-user-block__image"><img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1080&q=80" alt="Residents collaborating in a community" /><span /></div>
            <div className="landing-user-block__content landing-user-block__content--blue"><span className="landing-user-block__badge"><Icon name="phone" />For Residents</span><h3>Report, Track, and Engage</h3><ul>{residentFeatures.map((item) => <li key={item}><span className="landing-user-block__bullet"><i /></span>{item}</li>)}</ul><Link className="landing-btn landing-btn--large landing-btn--resident" to={ROUTES.LOGIN}>Start Reporting</Link></div>
          </div>
        </div>
        <div className="landing-user-block">
          <div className="landing-user-block__grid landing-user-block__grid--reverse">
            <div className="landing-user-block__image"><img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1080&q=80" alt="Community administration workspace" /><span /></div>
            <div className="landing-user-block__content landing-user-block__content--orange"><span className="landing-user-block__badge"><Icon name="chart" />For Community Operations</span><h3>Manage, Assign, and Resolve</h3><ul>{operationsFeatures.map((item) => <li key={item}><span className="landing-user-block__bullet"><i /></span>{item}</li>)}</ul><Link className="landing-btn landing-btn--large landing-btn--operations" to={ROUTES.LOGIN}>Access Dashboard</Link></div>
          </div>
        </div>
      </div>
    </section>

    <section id="benefits" className="landing-section landing-benefits">
      <div className="landing-benefits__pattern" />
      <div className="landing-container">
        <header className="landing-section__header"><span className="landing-benefits__badge">Community Operations</span><h2>Supporting Better Community Operations</h2><p>Urbanity brings residents, community administrators, and maintenance teams together for accountable, responsive shared-space management.</p></header>
        <div className="landing-benefits__grid">
          {benefits.map(([icon, title, description]) => <article className="landing-benefit-card" key={title}><span><Icon name={icon} /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </div>
    </section>

    <footer id="contact" className="landing-footer">
      <div className="landing-footer__cta"><div className="landing-container"><h2>Ready to Simplify Community Operations?</h2><p>Sign in to track complaints, coordinate maintenance, and keep residents informed.</p><Link className="landing-btn landing-btn--white landing-btn--large" to={ROUTES.LOGIN}>Get Started <span aria-hidden="true">→</span></Link></div></div>
      <div className="landing-footer__main"><div className="landing-container">
        <div className="landing-footer__grid">
          <div className="landing-footer__about"><h3>Urbanity</h3><p>Empowering communities through transparent complaint tracking and dependable maintenance coordination.</p><div className="landing-footer__social">{["facebook", "twitter", "linkedin", "instagram"].map((type) => <a href="#" aria-label={type} key={type}><SocialIcon type={type} /></a>)}</div></div>
          <div className="landing-footer__section"><h4>Quick Links</h4><ul><li>{sectionLink("#about", "About Us")}</li><li>{sectionLink("#features", "Features")}</li><li>{sectionLink("#how-it-works", "How It Works")}</li><li><a href="#">Blog</a></li></ul></div>
          <div className="landing-footer__section"><h4>Resources</h4><ul>{["Documentation", "API Reference", "Support Center", "Community Forum", "Training", "FAQs"].map((item) => <li key={item}><a href="#">{item}</a></li>)}</ul></div>
          <div className="landing-footer__section"><h4>Contact Us</h4><ul className="landing-footer__contact"><li><Icon name="mail" /><span>support@urbanity.com</span></li><li><Icon name="telephone" /><span>+91-9999999999</span></li><li><Icon name="location" /><span>IIIT SriCity, Gnan Marg Circle<br />Sri City, Chittoor District</span></li></ul></div>
        </div>
        <div className="landing-footer__bottom"><p>© 2026 Urbanity. All rights reserved.</p><div><a href="#">Privacy Policy</a><a href="#">Terms of Service</a><a href="#">Cookie Policy</a></div></div>
      </div></div>
    </footer>
  </main>;
}
