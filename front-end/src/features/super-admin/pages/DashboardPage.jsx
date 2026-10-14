import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Button, Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { MetricCard, MetricIcon, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { useAsyncResource } from "../hooks/useAsyncResource.js";
import { superAdminService } from "../services/superAdminService.js";
import { formatEnum } from "../utils/formatters.js";

function Breakdown({ title, values = {}, status = false }) {
  const entries = Object.entries(values);
  return (
    <Card title={title}>
      {entries.length ? <div className="sa-breakdown">{entries.map(([key, value]) => (
        <div key={key}><span>{status ? <StatusBadge status={key} /> : formatEnum(key)}</span><strong>{value}</strong></div>
      ))}</div> : <p className="sa-muted">No breakdown is available.</p>}
    </Card>
  );
}

export function DashboardPage() {
  const loader = useCallback(() => superAdminService.getDashboard(), []);
  const { data, loading, error, reload } = useAsyncResource(loader);

  return <>
    <PageHeader title="Platform overview" description="A clear view of your communities, people, and maintenance activity."
      actions={<><Button variant="secondary" onClick={reload} disabled={loading}>Refresh</Button><Link className="ui-button ui-button--primary" to={ROUTES.SUPER_ADMIN_COMMUNITIES}>Manage communities</Link></>} />
    {loading && <LoadingState message="Loading platform summary..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <>
      <div className="sa-metrics portal-metrics">
        <MetricCard icon={<MetricIcon name="communities" />} label="Communities" value={data.hierarchy?.communities ?? 0} />
        <MetricCard icon={<MetricIcon name="apartments" />} label="Apartments" value={data.hierarchy?.apartments ?? 0} hint={`${data.hierarchy?.towers ?? 0} towers · ${data.hierarchy?.floors ?? 0} floors`} />
        <MetricCard icon={<MetricIcon name="users" />} label="Users" value={Object.values(data.users || {}).reduce((sum, value) => sum + Number(value || 0), 0)} />
        <MetricCard icon={<MetricIcon name="complaints" />} label="Complaints" value={data.complaints?.total ?? 0} />
        <MetricCard icon={<MetricIcon name="workers" />} label="Workers" value={data.workforce?.total ?? 0} hint={`${data.workforce?.completedWorkCount ?? 0} completed`} />
      </div>
      <nav className="portal-action-grid" aria-label="Platform administration">
        <Link to={ROUTES.SUPER_ADMIN_COMMUNITIES}><MetricIcon name="communities" /><div><strong>Community operations</strong><span>Onboard communities and review contracted capacity.</span></div><span aria-hidden="true">›</span></Link>
        <Link to={ROUTES.SUPER_ADMIN_USERS}><MetricIcon name="users" /><div><strong>People and access</strong><span>Manage accounts and their role associations.</span></div><span aria-hidden="true">›</span></Link>
        <Link to={ROUTES.SUPER_ADMIN_REPORTS}><MetricIcon name="complaints" /><div><strong>Platform reports</strong><span>Review complaint and workforce summaries.</span></div><span aria-hidden="true">›</span></Link>
      </nav>
      <div className="sa-grid sa-grid--3">
        <Breakdown title="Users by role" values={data.users} />
        <Breakdown title="Complaints by status" values={data.complaints?.byStatus} status />
        <Breakdown title="Workforce availability" values={data.workforce?.byStatus} status />
      </div>
    </>}
  </>;
}
