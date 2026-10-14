import { Link } from "react-router-dom";
import { Button, Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { MetricCard, MetricIcon, PageHeader } from "../../../components/data-display/index.js";
import { CommunityIllustration } from "../../../components/data-display/CommunityIllustration.jsx";
import { ROUTES } from "../../../constants/routes.js";
import { residentService } from "../services/residentService.js";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { ResidentLocation } from "../components/ResidentLocation.jsx";
import { ComplaintList } from "../components/ComplaintList.jsx";

export function DashboardPage() {
  const complaints = useResidentResource(residentService.listComplaints);
  const hierarchy = useResidentResource(residentService.getHierarchy);
  const items = complaints.data;
  const count = (...statuses) => items.filter((item) => statuses.includes(item.status)).length;
  const ready = items?.filter((item) => item.status === "RESOLVED" && item.resolutionVerification) || [];
  const firstName = hierarchy.data?.user?.name?.split(" ")[0];
  return <div className="resident-stack">
    <PageHeader title={firstName ? `Welcome home, ${firstName}` : "Your home, looked after"} description="Your maintenance updates, all in one place."
      actions={<Button variant="secondary" disabled={complaints.loading || hierarchy.loading} onClick={() => { complaints.reload(); hierarchy.reload(); }}>Refresh updates</Button>} />
    <section className="resident-welcome">
      <div><span className="resident-welcome-label">Maintenance made simpler</span><h2>A small issue?<br />Let's get it sorted.</h2><p>Tell us what's happening. Follow the repair from your first report to verified resolution.</p>
        <Link className="ui-button ui-button--primary" to={ROUTES.RESIDENT_NEW_COMPLAINT}>Report an issue <span aria-hidden="true">+</span></Link></div>
      <CommunityIllustration className="resident-building" />
    </section>
    {complaints.loading && <LoadingState message="Loading your complaints..." />}
    {complaints.error && <ErrorState message={complaints.error.message} onRetry={complaints.reload} />}
    {items && <div className="resident-metrics">
      <MetricCard icon={<MetricIcon name="complaints" />} label="Total complaints" value={items.length} />
      <MetricCard icon={<MetricIcon name="progress" />} label="Open requests" value={count("SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "PENDING_VERIFICATION")} hint="From submission to verification" />
      <MetricCard icon={<MetricIcon name="verification" />} label="Awaiting verification" value={count("PENDING_VERIFICATION")} />
      <MetricCard icon={<MetricIcon name="resolved" />} label="Verified repairs" value={count("RESOLVED", "REVIEWED", "CLOSED")} />
    </div>}
    {ready.length > 0 && <section className="resident-review-callout" aria-label="Complaints ready for feedback">
      <span className="resident-issue-icon"><MetricIcon name="resolved" /></span><div><h2>{ready.length === 1 ? "A repair is ready for your feedback" : `${ready.length} repairs are ready for your feedback`}</h2><p>The work has been verified. Let us know how it went.</p>
        <ul>{ready.map((item) => <li key={item.id}><Link to={`${ROUTES.RESIDENT_COMPLAINTS}/${item.id}`}>{item.title}<span>Share feedback</span></Link></li>)}</ul></div>
    </section>}
    <div className="resident-overview-grid">
      <Card title="Recent activity" actions={<Link className="resident-inline-link" to={ROUTES.RESIDENT_COMPLAINTS}>All complaints</Link>} flush>
        {items && <ComplaintList complaints={[...items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5)} />}
        {!items && !complaints.error && <LoadingState message="Loading recent activity..." />}
        {!items && complaints.error && <p className="resident-panel-message">Your recent activity will appear when complaints can be loaded.</p>}
      </Card>
      <aside className="resident-stack">
        {hierarchy.loading ? <LoadingState message="Loading your apartment..." /> : hierarchy.error ? <ErrorState message={hierarchy.error.message} onRetry={hierarchy.reload} /> : <ResidentLocation hierarchy={hierarchy.data} />}
        <section className="resident-how-it-works"><h2>What happens after a report?</h2><ol><li><strong>Your authority reviews it</strong><span>The issue goes to your tower or community authority.</span></li><li><strong>A worker takes care of it</strong><span>A suitable worker completes the repair and submits proof.</span></li><li><strong>You have the final feedback</strong><span>Once verified, you can rate the service.</span></li></ol></section>
      </aside>
    </div>
  </div>;
}
