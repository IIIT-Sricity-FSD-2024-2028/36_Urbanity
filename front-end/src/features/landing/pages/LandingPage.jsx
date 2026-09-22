import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/index.js";
import { ROUTES } from "../../../constants/routes.js";
import "../landing.css";

const features = [
  ["Transparent complaint tracking", "Residents can follow community concerns through a clear, accountable lifecycle."],
  ["Coordinated maintenance", "Community teams can review work, assign eligible specialists, and verify outcomes."],
  ["Structured community hierarchy", "Keep towers, floors, apartments, residents, and representatives connected."],
  ["Operational reporting", "Use backend-supported summaries to understand complaints and workforce availability."],
];

const steps = [
  ["1", "Report", "Residents submit concerns from their associated apartment and community."],
  ["2", "Coordinate", "The responsible authority reviews the complaint and assigns an eligible worker."],
  ["3", "Resolve", "Maintenance workers complete the task and submit proof for verification."],
  ["4", "Close the loop", "Residents review the outcome before the authority closes the complaint."],
];

export function LandingPage() {
  return <main className="landing">
    <header className="landing-nav"><Link className="landing-brand" to={ROUTES.HOME}>Urbanity</Link><nav aria-label="Landing page"><a href="#features">Features</a><a href="#workflow">How it works</a><a href="#community">Benefits</a></nav><Link className="landing-button landing-button--outline" to={ROUTES.LOGIN}>Sign in</Link></header>
    <section className="landing-hero"><div className="landing-hero__content"><p className="landing-eyebrow">Apartment community operations</p><h1>Better communities begin with clear, accountable service.</h1><p>Urbanity connects residents, community administrators, tower representatives, and maintenance teams in one focused complaint and maintenance workflow.</p><div className="landing-actions"><Link className="landing-button" to={ROUTES.LOGIN}>Get started</Link><a className="landing-button landing-button--quiet" href="#features">Explore features</a></div></div><div className="landing-hero__panel" aria-label="Urbanity operational overview"><span>Community → Tower → Floor → Apartment</span><strong>One connected workflow</strong><ul><li>Backend-authorized access</li><li>Visible complaint progress</li><li>Community-scoped workforce</li></ul></div></section>
    <section id="features" className="landing-section"><div className="landing-heading"><p className="landing-eyebrow">Platform features</p><h2>Everything needed to keep community work moving</h2><p>Urbanity provides focused tools for each role while preserving community and hierarchy boundaries.</p></div><div className="landing-card-grid">{features.map(([title, description]) => <Card key={title}><span className="landing-card-icon" aria-hidden="true">✓</span><h3>{title}</h3><p>{description}</p></Card>)}</div></section>
    <section id="workflow" className="landing-section landing-section--tinted"><div className="landing-heading"><p className="landing-eyebrow">How it works</p><h2>A complete path from report to resolution</h2></div><div className="landing-steps">{steps.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section id="community" className="landing-section"><div className="landing-split"><div><p className="landing-eyebrow">Community operations</p><h2>Shared visibility, role-specific responsibility</h2><p>Residents know where their complaint stands. Administrators and representatives coordinate the right work. Maintenance workers focus on assigned tasks and proof of completion.</p></div><ul><li>Transparent administration and resident communication</li><li>Faster maintenance coordination</li><li>Structured ownership across the community hierarchy</li><li>Operational summaries based on real backend data</li></ul></div></section>
    <section className="landing-cta"><div><h2>Ready to simplify community operations?</h2><p>Sign in to access the Urbanity workspace for your role.</p></div><Link className="landing-button landing-button--light" to={ROUTES.LOGIN}>Access Urbanity</Link></section>
    <footer className="landing-footer"><div><Link className="landing-brand" to={ROUTES.HOME}>Urbanity</Link><p>Transparent complaint tracking and dependable maintenance coordination for apartment communities.</p></div><div><strong>Platform</strong><a href="#features">Features</a><a href="#workflow">How it works</a><Link to={ROUTES.LOGIN}>Sign in</Link></div><p>© 2026 Urbanity. All rights reserved.</p></footer>
  </main>;
}
