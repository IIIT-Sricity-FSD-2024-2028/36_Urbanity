import { useState } from "react";
import { Link } from "react-router-dom";
import { CommunityIllustration } from "../../../components/data-display/CommunityIllustration.jsx";
import { MetricIcon } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import "../landing.css";

const capabilities = [
  ["complaints", "A report with the right context", "Apartment, tower, or community. Describe the issue and attach photos; your registered home determines where it goes."],
  ["workers", "Work assigned to the right person", "Authorities select an available worker in the community with the specialization needed for the repair."],
  ["verification", "Completion backed by proof", "Workers submit repair notes and images. The responsible authority verifies the work before residents review it."],
  ["communities", "One connected community", "Manage towers, floors, apartments, people, and worker profiles within the right community scope."],
];
const steps = [
  ["Report the issue", "A resident describes the problem and adds supporting images."],
  ["Review and assign", "The responsible authority reviews the report and selects an eligible worker."],
  ["Repair and verify", "The worker submits proof; the authority checks and rates the completed work."],
  ["Share feedback", "The resident rates the service before the authority closes the complaint."],
];
const roles = [
  ["Residents", "Report an issue, follow its progress, and review verified repairs."],
  ["Maintenance workers", "See assigned tasks, start work, and submit repair notes and proof."],
  ["Tower representatives", "Review tower complaints, assign workers, and verify resolutions."],
  ["Community admins", "Manage the community hierarchy, accounts, workforce, and community complaints."],
  ["Super admins", "Onboard communities and oversee platform-wide activity."],
];

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sectionLink = (href, label) => <a href={href} onClick={() => setMobileOpen(false)}>{label}</a>;
  return <main className="landing-page" id="public-main-content" tabIndex={-1}>
    <nav className="landing-nav" aria-label="Main navigation">
      <div className="landing-container landing-nav__container">
        <Link className="landing-logo" to={ROUTES.HOME} aria-label="Urbanity home"><span><MetricIcon name="communities" /></span>Urbanity</Link>
        <div className="landing-nav__links">{sectionLink("#features", "Features")}{sectionLink("#how-it-works", "How it works")}{sectionLink("#about", "Who it's for")}</div>
        <Link className="ui-button ui-button--primary landing-nav__signin" to={ROUTES.LOGIN}>Sign in</Link>
        <button className="landing-nav__menu" type="button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="landing-mobile-navigation" onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? "Close" : "Menu"}</button>
      </div>
      {mobileOpen && <div id="landing-mobile-navigation" className="landing-nav__mobile">{sectionLink("#features", "Features")}{sectionLink("#how-it-works", "How it works")}{sectionLink("#about", "Who it's for")}<Link to={ROUTES.LOGIN}>Sign in</Link></div>}
    </nav>
    <section className="landing-hero landing-container">
      <div className="landing-hero__copy"><p className="landing-intro">Apartment maintenance, connected.</p><h1>A better way to<br />look after home.</h1><p className="landing-hero__description">From a leaking tap to a shared-space repair, give every issue a clear path. Urbanity connects residents, community authorities, and maintenance teams in one workspace.</p>
        <div className="landing-hero__actions"><Link className="ui-button ui-button--primary" to={ROUTES.LOGIN}>Open your workspace</Link><a className="landing-text-link" href="#how-it-works">See how it works</a></div>
        <p className="landing-account-note">Have an account? Sign in with the details provided by your administrator.</p>
      </div>
      <div className="landing-hero__visual"><CommunityIllustration /><div className="landing-visual-caption"><MetricIcon name="resolved" /><div><strong>A repair is complete when it's verified.</strong><span>Proof of work, authority checks, and resident feedback.</span></div></div></div>
    </section>
    <section id="features" className="landing-section landing-container">
      <header className="landing-section__header"><h2>Less chasing.<br />More clarity.</h2><p>The details, people, and progress behind each repair stay connected from the first report.</p></header>
      <div className="landing-feature-grid">{capabilities.map(([icon, title, description]) => <article className="landing-feature" key={title}><span className="landing-feature__icon"><MetricIcon name={icon} /></span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
    </section>
    <section id="how-it-works" className="landing-workflow"><div className="landing-container landing-workflow__layout"><header><p className="landing-intro">From report to repair</p><h2>Everyone knows<br />the next step.</h2><p>Every complaint follows the same accountable process, with a recorded status history.</p></header><ol className="landing-steps">{steps.map(([title, description]) => <li key={title}><h3>{title}</h3><p>{description}</p></li>)}</ol></div></section>
    <section id="about" className="landing-section landing-container"><header className="landing-section__header"><h2>One community.<br />Different responsibilities.</h2><p>Each person has a workspace for the work they do, with access limited to their role and scope.</p></header><div className="landing-role-list">{roles.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <footer id="contact" className="landing-footer landing-container"><div className="landing-footer__cta"><div><h2>Your community workspace is here.</h2><p>Sign in to report, coordinate, or track maintenance.</p></div><Link className="ui-button ui-button--primary" to={ROUTES.LOGIN}>Sign in to Urbanity</Link></div><div className="landing-footer__bottom"><span>Urbanity · Apartment operations</span><nav aria-label="Footer navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a><Link to={ROUTES.LOGIN}>Sign in</Link></nav></div></footer>
  </main>;
}
