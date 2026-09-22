import { useCallback } from "react";
import { Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { MetricCard, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
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
    <PageHeader eyebrow="Community overview" title="Community dashboard" description="Live hierarchy, people, complaints, and workforce totals for your community." />
    {loading && <LoadingState message="Loading community summary..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <><div className="ca-metrics">
      <MetricCard icon="T" label="Towers" value={data.hierarchy?.towers ?? 0} />
      <MetricCard icon="A" label="Apartments" value={data.hierarchy?.apartments ?? 0} hint={`${data.hierarchy?.floors ?? 0} floors`} />
      <MetricCard icon="U" label="Users" value={Object.values(data.users || {}).reduce((sum, value) => sum + Number(value || 0), 0)} />
      <MetricCard icon="!" label="Complaints" value={data.complaints?.total ?? 0} />
      <MetricCard icon="W" label="Workers" value={data.workforce?.total ?? 0} hint={`${data.workforce?.completedWorkCount ?? 0} completed`} />
    </div><div className="ca-grid ca-grid--3"><Breakdown title="Users by role" values={data.users} /><Breakdown title="Complaints by status" values={data.complaints?.byStatus} statuses /><Breakdown title="Workforce availability" values={data.workforce?.byStatus} statuses /></div></>}
  </>;
}
