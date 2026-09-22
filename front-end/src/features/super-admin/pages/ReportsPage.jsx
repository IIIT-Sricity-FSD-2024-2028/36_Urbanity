import { useCallback } from "react";
import { Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { MetricCard, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { useAsyncResource } from "../hooks/useAsyncResource.js";
import { superAdminService } from "../services/superAdminService.js";
import { formatDate, formatEnum } from "../utils/formatters.js";

function ReportList({ values = {}, status = false }) {
  const entries = Object.entries(values);
  return entries.length ? <div className="sa-breakdown">{entries.map(([key, value]) => (
    <div key={key}><span>{status ? <StatusBadge status={key} /> : formatEnum(key)}</span><strong>{value}</strong></div>
  ))}</div> : <p className="sa-muted">No data reported.</p>;
}

export function ReportsPage() {
  const loader = useCallback(() => superAdminService.getReport(), []);
  const { data, loading, error, reload } = useAsyncResource(loader);
  const summary = data;
  return <>
    <PageHeader eyebrow="Analytics" title="Platform reports" description={data ? `Generated ${formatDate(data.generatedAt)}` : "Backend-supported operational summaries."} />
    {loading && <LoadingState message="Generating report..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {summary && <>
      <div className="sa-metrics">
        <MetricCard label="Communities" value={summary.hierarchy?.communities ?? 0} />
        <MetricCard label="Users" value={Object.values(summary.users || {}).reduce((a, b) => a + Number(b || 0), 0)} />
        <MetricCard label="Complaints" value={summary.complaints?.total ?? 0} />
        <MetricCard label="Average worker rating" value={summary.workforce?.averageRating ?? 0} />
      </div>
      <div className="sa-grid sa-grid--2">
        <Card title="Complaint statuses"><ReportList values={summary.complaints?.byStatus} status /></Card>
        <Card title="Complaint types"><ReportList values={data.complaintTypes || summary.complaints?.byType} /></Card>
        <Card title="Required work types"><ReportList values={data.requiredWorkTypes} /></Card>
        <Card title="Workforce statuses"><ReportList values={summary.workforce?.byStatus} status /></Card>
      </div>
    </>}
  </>;
}
