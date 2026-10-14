import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Button, Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { MetricCard, MetricIcon, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { useCommunityResource } from "../hooks/useCommunityResource.js";
import { communityAdminService } from "../services/communityAdminService.js";
import { formatEnum } from "../utils.js";

function Breakdown({ title, values = {}, statuses = false }) {
  const entries = Object.entries(values);
  return <Card title={title}>{entries.length ? <div className="ca-breakdown">{entries.map(([key, value]) => <div key={key}><span>{statuses ? <StatusBadge status={key} /> : formatEnum(key)}</span><strong>{value}</strong></div>)}</div> : <p className="ca-muted">No data is available.</p>}</Card>;
}

export function DashboardPage() {
  const loader = useCallback(() => communityAdminService.getDashboard(), []);
  const { data, loading, error, reload } = useCommunityResource(loader);
  return <>
    <PageHeader title="Community overview" description="Keep your community's maintenance and everyday operations moving."
      actions={<><Button variant="secondary" onClick={reload} disabled={loading}>Refresh</Button><Link className="ui-button ui-button--primary" to={ROUTES.COMMUNITY_ADMIN_COMPLAINTS}>View complaints</Link></>} />
    {loading && <LoadingState message="Loading community summary..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <>
    <section className="ca-attention" aria-label="Community complaint attention"><div><h2>Keep an eye on the queue</h2><p>Community totals include complaints handled by tower representatives.</p></div><dl><div><dt>Submitted</dt><dd>{data.complaints?.byStatus?.SUBMITTED ?? 0}</dd></div><div><dt>Awaiting verification</dt><dd>{data.complaints?.byStatus?.PENDING_VERIFICATION ?? 0}</dd></div></dl><Link className="ui-button ui-button--secondary" to={ROUTES.COMMUNITY_ADMIN_COMPLAINTS}>Open complaint queue</Link></section>
    <div className="ca-metrics portal-metrics">
      <MetricCard icon={<MetricIcon name="towers" />} label="Towers" value={data.hierarchy?.towers ?? 0} />
      <MetricCard icon={<MetricIcon name="apartments" />} label="Apartments" value={data.hierarchy?.apartments ?? 0} hint={`${data.hierarchy?.floors ?? 0} floors`} />
      <MetricCard icon={<MetricIcon name="users" />} label="Users" value={Object.values(data.users || {}).reduce((sum, value) => sum + Number(value || 0), 0)} />
      <MetricCard icon={<MetricIcon name="complaints" />} label="Complaints" value={data.complaints?.total ?? 0} />
      <MetricCard icon={<MetricIcon name="workers" />} label="Workers" value={data.workforce?.total ?? 0} hint={`${data.workforce?.completedWorkCount ?? 0} completed`} />
    </div>
    <nav className="portal-action-grid" aria-label="Community administration"><Link to={ROUTES.COMMUNITY_ADMIN_HIERARCHY}><MetricIcon name="towers" /><div><strong>Your community structure</strong><span>Manage towers, floors, and apartments.</span></div><span aria-hidden="true">›</span></Link><Link to={ROUTES.COMMUNITY_ADMIN_WORKFORCE}><MetricIcon name="workers" /><div><strong>Maintenance workforce</strong><span>Review worker profiles and availability.</span></div><span aria-hidden="true">›</span></Link></nav>
    <div className="ca-grid ca-grid--3"><Breakdown title="Users by role" values={data.users} /><Breakdown title="Complaints by status" values={data.complaints?.byStatus} statuses /><Breakdown title="Workforce availability" values={data.workforce?.byStatus} statuses /></div></>}
  </>;
}
