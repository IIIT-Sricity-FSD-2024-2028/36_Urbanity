import { useCallback } from "react";
import { Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { MetricCard, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
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
    <PageHeader eyebrow="Platform overview" title="Super Admin dashboard" description="Live hierarchy, people, complaint, and workforce totals from Urbanity." />
    {loading && <LoadingState message="Loading platform summary..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <>
      <div className="sa-metrics">
        <MetricCard icon="C" label="Communities" value={data.hierarchy?.communities ?? 0} />
        <MetricCard icon="A" label="Apartments" value={data.hierarchy?.apartments ?? 0} hint={`${data.hierarchy?.towers ?? 0} towers · ${data.hierarchy?.floors ?? 0} floors`} />
        <MetricCard icon="U" label="Users" value={Object.values(data.users || {}).reduce((sum, value) => sum + Number(value || 0), 0)} />
        <MetricCard icon="!" label="Complaints" value={data.complaints?.total ?? 0} />
        <MetricCard icon="W" label="Workers" value={data.workforce?.total ?? 0} hint={`${data.workforce?.completedWorkCount ?? 0} completed`} />
      </div>
      <div className="sa-grid sa-grid--3">
        <Breakdown title="Users by role" values={data.users} />
        <Breakdown title="Complaints by status" values={data.complaints?.byStatus} status />
        <Breakdown title="Workforce availability" values={data.workforce?.byStatus} status />
      </div>
    </>}
  </>;
}
