import { Link } from "react-router-dom";
import { Button, Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { MetricCard, PageHeader } from "../../../components/data-display/index.js";
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
  return <div className="resident-stack">
    <PageHeader eyebrow="Resident workspace" title="Resident dashboard" description="Track maintenance requests and your registered apartment."
      actions={<><Button variant="secondary" disabled={complaints.loading || hierarchy.loading} onClick={() => { complaints.reload(); hierarchy.reload(); }}>Refresh</Button><Link className="ui-button ui-button--primary" to={ROUTES.RESIDENT_NEW_COMPLAINT}>Create complaint</Link></>} />
    {complaints.loading && <LoadingState message="Loading your complaints..." />}
    {complaints.error && <ErrorState message={complaints.error.message} onRetry={complaints.reload} />}
    {items && <>
      <div className="resident-metrics">
        <MetricCard label="My complaints" value={items.length} />
        <MetricCard label="Submitted" value={count("SUBMITTED")} />
        <MetricCard label="Under review / assigned" value={count("UNDER_REVIEW", "ASSIGNED")} />
        <MetricCard label="In progress" value={count("IN_PROGRESS")} />
        <MetricCard label="Awaiting verification" value={count("PENDING_VERIFICATION")} />
        <MetricCard label="Resolved" value={count("RESOLVED", "REVIEWED", "CLOSED")} hint="Includes reviewed and closed requests" />
      </div>
      {ready.length > 0 && <Card title="Ready for your review"><ul className="resident-stack">{ready.map((item) => <li key={item.id}><Link to={`${ROUTES.RESIDENT_COMPLAINTS}/${item.id}`}>{item.title}</Link> — Resolution verified; share your feedback.</li>)}</ul></Card>}
    </>}
    {hierarchy.loading ? <LoadingState message="Loading your apartment..." /> : hierarchy.error ? <ErrorState message={hierarchy.error.message} onRetry={hierarchy.reload} /> : <ResidentLocation hierarchy={hierarchy.data} />}
    {items && <Card title="Recent complaints" actions={<Link to={ROUTES.RESIDENT_COMPLAINTS}>View all complaints</Link>} flush>
      <ComplaintList complaints={[...items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5)} />
    </Card>}
  </div>;
}
