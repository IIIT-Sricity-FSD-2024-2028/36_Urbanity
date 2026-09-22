import { useCallback } from "react";
import { Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { MetricCard, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { useCommunityResource } from "../hooks/useCommunityResource.js";
import { communityAdminService } from "../services/communityAdminService.js";
import { formatDate, formatEnum } from "../utils.js";

function ReportList({ values = {}, statuses = false }) { const entries = Object.entries(values); return entries.length ? <div className="ca-breakdown">{entries.map(([key, value]) => <div key={key}><span>{statuses ? <StatusBadge status={key} /> : formatEnum(key)}</span><strong>{value}</strong></div>)}</div> : <p className="ca-muted">No report data.</p>; }

export function ReportsPage() {
  const loader = useCallback(() => communityAdminService.getReport(), []); const { data, loading, error, reload } = useCommunityResource(loader);
  return <><PageHeader eyebrow="Community analytics" title="Reports" description={data ? `Generated ${formatDate(data.generatedAt)}` : "Backend-supported community operational summaries."} />{loading && <LoadingState message="Generating community report..." />}{error && <ErrorState message={error.message} onRetry={reload} />}{data && <><div className="ca-metrics"><MetricCard label="Towers" value={data.hierarchy?.towers ?? 0} /><MetricCard label="Apartments" value={data.hierarchy?.apartments ?? 0} /><MetricCard label="Complaints" value={data.complaints?.total ?? 0} /><MetricCard label="Average worker rating" value={data.workforce?.averageRating ?? 0} /></div><div className="ca-grid ca-grid--2"><Card title="Complaint statuses"><ReportList values={data.complaints?.byStatus} statuses /></Card><Card title="Complaint types"><ReportList values={data.complaintTypes || data.complaints?.byType} /></Card><Card title="Required work types"><ReportList values={data.requiredWorkTypes} /></Card><Card title="Workforce statuses"><ReportList values={data.workforce?.byStatus} statuses /></Card></div></>}</>;
}
