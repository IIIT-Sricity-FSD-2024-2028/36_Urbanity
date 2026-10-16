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
  ["building", "Community Management", "#3B9EFF"],
  ["users", "Paid Services", "#4CAF50"],
  ["clock", "Amenity Bookings", "#FF9800"],
  ["shield", "Rental Management", "#9C27B0"],
];

const features = [
  ["globe", "Community Structure", "Organize towers, floors, apartments and people with access for each role.", "#3B9EFF", "rgba(59, 158, 255, 0.08)"],
  ["check", "Maintenance & Complaints", "Report concerns, assign community workers and verify completed work.", "#4CAF50", "rgba(76, 175, 80, 0.08)"],
  ["clock", "Amenity Bookings", "Check availability, reserve facilities and manage community booking rules.", "#FF9800", "rgba(255, 152, 0, 0.08)"],
  ["users", "Paid Services", "Request services from existing community maintenance workers and track progress.", "#9C27B0", "rgba(156, 39, 176, 0.08)"],
  ["building", "Rental Management", "Manage listings, leases, rent evidence and tenant onboarding in one place.", "#E91E63", "rgba(233, 30, 99, 0.08)"],
  ["shield", "Clear Oversight", "Keep community administration separate from platform management with scoped access.", "#00BCD4", "rgba(0, 188, 212, 0.08)"],
];

const stats = [
  ["5", "Connected Roles", "Access for each responsibility"],
  ["4", "Hierarchy Levels", "Community to apartment"],
  ["1", "Community Workspace", "Daily operations together"],
  ["Your", "Community in Control", "Scoped administration"],
];

const steps = [
  ["1", "chat", "Register", "Apply as your community's authorized representative and review the platform fee.", "#3B9EFF", "rgba(59, 158, 255, 0.08)"],
  ["2", "search", "Review", "Submit initial payment evidence for Super Admin verification and application review.", "#9C27B0", "rgba(156, 39, 176, 0.08)"],
  ["3", "shield", "Complete Setup", "After approval, set your password and submit the remaining payment for verification.", "#FF9800", "rgba(255, 152, 0, 0.08)"],
  ["4", "check", "Get Activated", "The Super Admin activates eligible communities. Then configure your community in the portal.", "#4CAF50", "rgba(76, 175, 80, 0.08)"],
];

const residentFeatures = [
  "Report apartment and shared-space concerns",
  "Upload photos and follow complaint progress",
  "Request paid services from community workers",
  "Check amenity availability and reserve facilities",
  "Access supported rental and tenancy workflows",
  "Review completed service work",
];

const operationsFeatures = [
  "Configure towers, floors and apartments",
  "Manage residents, representatives and workers",
  "Assign maintenance work and verify completion",
  "Manage amenity rules, closures and bookings",
  "Oversee community rentals and paid services",
  "View community reports and operational summaries",
];

const benefits = [
  ["eye", "Visible Progress", "Follow complaints and service requests through their recorded statuses."],
  ["shield", "Access by Role", "Give each person the tools appropriate to their community responsibility."],
  ["group", "Connected Residents", "Bring concerns, services and shared facilities into one resident portal."],
  ["building", "Community Organization", "Keep towers, floors, apartments and people connected to the right community."],
  ["check", "Verified Onboarding", "Community registration requires review, payment verification and account setup."],
  ["clock", "Shared-Space Planning", "Use facility availability and booking rules to coordinate community amenities."],
];

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
          <li>{sectionLink("#about", "About")}</li>
          <li>{sectionLink("#benefits", "Benefits")}</li>
          <li>{sectionLink("#contact", "Contact")}</li>
        </ul>
        <div className="landing-nav__buttons">
          <Link className="landing-btn landing-btn--ghost" to={ROUTES.LOGIN}>Login</Link>
          <Link className="landing-btn landing-btn--primary" to={ROUTES.REGISTER}>Register Your Community</Link>
        </div>
        <button className="landing-nav__menu" type="button" aria-label="Toggle navigation" aria-expanded={mobileOpen} aria-controls="landing-mobile-navigation" onClick={() => setMobileOpen((current) => !current)}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
        </button>
      </div>
      <div id="landing-mobile-navigation" className={`landing-nav__mobile${mobileOpen ? " landing-nav__mobile--open" : ""}`}>
        {sectionLink("#features", "Features")}
        {sectionLink("#how-it-works", "How It Works")}
        {sectionLink("#about", "About")}
        {sectionLink("#benefits", "Benefits")}
        {sectionLink("#contact", "Contact")}
        <Link to={ROUTES.LOGIN} onClick={() => setMobileOpen(false)}>Login</Link>
        <Link className="landing-btn landing-btn--primary" to={ROUTES.REGISTER} onClick={() => setMobileOpen(false)}>Register Your Community</Link>
      </div>
    </nav>

    <section className="landing-hero">
      <div className="landing-hero__background"><img src="https://images.unsplash.com/photo-1747499967281-c0c5eec9933c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjaXR5JTIwc2t5bGluZSUyMHNtYXJ0fGVufDF8fHx8MTc3MjkwMzg0M3ww&ixlib=rb-4.1.0&q=80&w=1080" alt="Modern city skyline" /><div /></div>
      <div className="landing-container landing-hero__content">
        <div className="landing-hero__grid">
          <div className="landing-hero__text">
            <h1><span>Urbanity</span></h1>
            <p className="landing-hero__subtitle">One place for the everyday life of your community.</p>
            <p className="landing-hero__description">Bring residents, administrators and maintenance teams together. Manage your buildings, resolve issues and make shared spaces easier to enjoy.</p>
            <div className="landing-hero__buttons">
              <Link className="landing-btn landing-btn--primary landing-btn--large" to={ROUTES.REGISTER}>Register Your Community <span aria-hidden="true">→</span></Link>
              <Link className="landing-btn landing-btn--outline landing-btn--large" to={ROUTES.LOGIN}>Login</Link>
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
        <header className="landing-section__header"><h2>Tools for the people who keep a community running.</h2><p>Manage community operations, resident services and shared facilities in one place.</p></header>
        <div className="landing-features__grid">
          {features.map(([icon, title, description, color, background]) => <article className="landing-feature-card" key={title}><span className="landing-feature-card__icon" style={{ backgroundColor: background }}><Icon name={icon} color={color} /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </div>
    </section>

    <section id="stats" className="landing-section landing-stats">
      <div className="landing-stats__decoration"><span /><span /></div>
      <div className="landing-container">
        <header className="landing-section__header"><h2>One Connected Platform</h2><p>A shared structure for your people, buildings and daily operations</p></header>
        <div className="landing-stats__grid">
          {stats.map(([value, label, change]) => <article className="landing-stat-card" key={label}><strong>{value}</strong><p>{label}</p><span><Icon name="trend" />{change}</span></article>)}
        </div>
      </div>
    </section>

    <section id="how-it-works" className="landing-section landing-workflow">
      <div className="landing-container">
        <header className="landing-section__header"><h2>How It Works</h2><p>From community registration to approved, verified and activated access</p></header>
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
            <div className="landing-user-block__content landing-user-block__content--blue"><span className="landing-user-block__badge"><Icon name="phone" />For Residents</span><h3>Report, Reserve, and Stay Connected</h3><ul>{residentFeatures.map((item) => <li key={item}><span className="landing-user-block__bullet"><i /></span>{item}</li>)}</ul><Link className="landing-btn landing-btn--large landing-btn--resident" to={ROUTES.LOGIN}>Resident Login</Link></div>
          </div>
        </div>
        <div className="landing-user-block">
          <div className="landing-user-block__grid landing-user-block__grid--reverse">
            <div className="landing-user-block__image"><img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1080&q=80" alt="Community administration workspace" /><span /></div>
            <div className="landing-user-block__content landing-user-block__content--orange"><span className="landing-user-block__badge"><Icon name="chart" />For Community Operations</span><h3>Organize, Assign, and Manage</h3><ul>{operationsFeatures.map((item) => <li key={item}><span className="landing-user-block__bullet"><i /></span>{item}</li>)}</ul><Link className="landing-btn landing-btn--large landing-btn--operations" to={ROUTES.LOGIN}>Access Dashboard</Link></div>
          </div>
        </div>
      </div>
    </section>

    <section id="benefits" className="landing-section landing-benefits">
      <div className="landing-benefits__pattern" />
      <div className="landing-container">
        <header className="landing-section__header"><span className="landing-benefits__badge">Community Operations</span><h2>Supporting Better Community Operations</h2><p>Urbanity brings residents, community administrators and maintenance teams together for everyday services and shared-space management.</p></header>
        <div className="landing-benefits__grid">
          {benefits.map(([icon, title, description]) => <article className="landing-benefit-card" key={title}><span><Icon name={icon} /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </div>
    </section>

    <footer id="contact" className="landing-footer">
      <div className="landing-footer__cta"><div className="landing-container"><h2>Ready to Simplify Community Operations?</h2><p>Register your community to begin review. Access starts after approval, verified payment and account setup.</p><Link className="landing-btn landing-btn--white landing-btn--large" to={ROUTES.REGISTER}>Register Your Community <span aria-hidden="true">→</span></Link></div></div>
      <div className="landing-footer__main"><div className="landing-container">
        <div className="landing-footer__grid">
          <div className="landing-footer__about"><h3>Urbanity</h3><p>Community administration, maintenance, rentals, paid services and amenity bookings in one place.</p><div className="landing-footer__social"><Link to={ROUTES.HOME} aria-label="Urbanity home"><Icon name="building" /></Link><Link to={ROUTES.REGISTER} aria-label="Register your community"><Icon name="users" /></Link><Link to={ROUTES.LOGIN} aria-label="Portal login"><Icon name="shield" /></Link></div></div>
          <div className="landing-footer__section"><h4>Quick Links</h4><ul><li>{sectionLink("#about", "About")}</li><li>{sectionLink("#features", "Features")}</li><li>{sectionLink("#how-it-works", "How It Works")}</li><li><Link to={ROUTES.REGISTER}>Register Your Community</Link></li></ul></div>
          <div className="landing-footer__section"><h4>Get Started</h4><ul><li><Link to={ROUTES.REGISTER}>Community Registration</Link></li><li><Link to={ROUTES.LOGIN}>Portal Login</Link></li><li>{sectionLink("#how-it-works", "Onboarding Process")}</li><li>{sectionLink("#benefits", "Platform Benefits")}</li></ul></div>
          <div className="landing-footer__section"><h4>Need Help?</h4><ul className="landing-footer__contact"><li><Icon name="users" /><span>Residents: contact your community administrator.</span></li><li><Icon name="mail" /><span>Applicants: retain your registration reference and contact the platform administrator.</span></li><li><Icon name="shield" /><span>No passwords or invitations are emailed automatically.</span></li></ul></div>
        </div>
        <div className="landing-footer__bottom"><p>© 2026 Urbanity. All rights reserved.</p><div><Link to={ROUTES.REGISTER}>Register Your Community</Link><Link to={ROUTES.LOGIN}>Login</Link><a href="#features" onClick={(event) => scrollToSection(event, "#features")}>Features</a></div></div>
      </div></div>
    </footer>
  </main>;
}
