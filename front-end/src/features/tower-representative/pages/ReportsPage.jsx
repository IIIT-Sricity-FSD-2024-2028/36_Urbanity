import { useCallback, useMemo } from "react";
import { Button, Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { DataTable, MetricCard, PageHeader } from "../../../components/data-display/index.js";
import { Breakdown } from "../components/Breakdown.jsx";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import {
  COMPLAINT_STATUSES,
  RESOLVED_STATUSES,
  activeWorkload,
  countBy,
  formatDateTime,
  formatEnum,
  formatRating,
  workerReference,
} from "../utils/formatters.js";

// /reports/overview is restricted to Super Admin and Community Admin, so these
// figures are aggregated from the complaint and workforce records this role can read.
function averageResolutionHours(complaints) {
  const durations = complaints
    .map((complaint) => {
      const resolved = (complaint.statusHistory || []).find((entry) => entry.status === "RESOLVED");
      if (!resolved || !complaint.createdAt) return null;
      return (new Date(resolved.changedAt).getTime() - new Date(complaint.createdAt).getTime()) / 3_600_000;
    })
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (!durations.length) return null;
  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}

function monthlyTrend(complaints) {
  const counts = countBy(complaints, (complaint) => String(complaint.createdAt || "").slice(0, 7));
  return Object.fromEntries(
    Object.entries(counts)
      .filter(([month]) => /^\d{4}-\d{2}$/.test(month))
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, value]) => [new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }), value]),
  );
}

export function ReportsPage() {
  const loader = useCallback(async () => {
    const [complaints, workers] = await Promise.all([
      towerRepresentativeService.listComplaints(),
      towerRepresentativeService.listWorkers(),
    ]);
    return { complaints, workers, generatedAt: new Date().toISOString() };
  }, []);
  const { data, error, initialLoading, loading, reload } = useTowerResource(loader);

  const report = useMemo(() => {
    if (!data) return null;
    const { complaints, workers } = data;
    const resolved = complaints.filter((complaint) => RESOLVED_STATUSES.has(complaint.status)).length;
    const averageHours = averageResolutionHours(complaints);
    const assignedWorkerIds = new Set(complaints.map((complaint) => complaint.assignedWorkerId).filter(Boolean));
    return {
      total: complaints.length,
      resolved,
      open: complaints.length - resolved,
      resolutionRate: complaints.length ? Math.round((resolved / complaints.length) * 100) : 0,
      averageResolution: averageHours === null ? "Not available" : `${averageHours.toFixed(1)} hours`,
      byStatus: countBy(complaints, (complaint) => complaint.status),
      byType: countBy(complaints, (complaint) => complaint.type),
      byWorkType: countBy(complaints, (complaint) => complaint.requiredWorkType),
      byFloor: countBy(complaints, (complaint) => complaint.location?.floorLabel || "Unavailable"),
      trend: monthlyTrend(complaints),
      workerRows: workers
        .filter((worker) => assignedWorkerIds.has(worker.id))
        .map((worker) => ({
          ...worker,
          towerComplaints: complaints.filter((complaint) => complaint.assignedWorkerId === worker.id).length,
          activeTasks: activeWorkload(complaints, worker.id),
        }))
        .sort((a, b) => b.towerComplaints - a.towerComplaints),
    };
  }, [data]);

  const workerColumns = [
    { key: "id", header: "Worker profile", render: (_, row) => <strong>{workerReference(row)}</strong> },
    { key: "specialization", header: "Specialization", render: formatEnum },
    { key: "towerComplaints", header: "Tower complaints assigned" },
    { key: "activeTasks", header: "Active in your tower" },
    { key: "completedWorkCount", header: "Completed (community)", render: (value) => value || 0 },
    { key: "rating", header: "Rating", render: formatRating },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Tower analytics"
        title="Reports"
        description={data ? `Calculated from complaint and workforce records in your scope · ${formatDateTime(data.generatedAt)}` : "Summaries calculated from complaint and workforce records in your scope."}
        actions={<Button variant="secondary" onClick={reload} loading={loading && Boolean(data)} loadingLabel="Refreshing...">Refresh</Button>}
      />
      {initialLoading && <LoadingState message="Preparing tower report..." />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {report && (
        <>
          <div className="tr-metrics">
            <MetricCard label="Total complaints" value={report.total} />
            <MetricCard label="Open complaints" value={report.open} />
            <MetricCard label="Resolved complaints" value={report.resolved} hint="Resolved, reviewed, or closed" />
            <MetricCard label="Resolution rate" value={`${report.resolutionRate}%`} />
            <MetricCard label="Average resolution time" value={report.averageResolution} hint="Creation to verified resolution" />
          </div>
          <div className="tr-grid tr-grid--2">
            <Card title="Complaints by status"><Breakdown values={report.byStatus} order={COMPLAINT_STATUSES} status bars emptyMessage="No complaint data available." /></Card>
            <Card title="Complaints by month (last 6 active months)"><Breakdown values={report.trend} order={Object.keys(report.trend)} bars emptyMessage="No complaint activity available." /></Card>
            <Card title="Required work type"><Breakdown values={report.byWorkType} bars emptyMessage="No complaint data available." /></Card>
            <Card title="Complaints by floor"><Breakdown values={report.byFloor} bars emptyMessage="No complaint data available." /></Card>
            <Card title="Complaint type"><Breakdown values={report.byType} bars emptyMessage="No complaint data available." /></Card>
          </div>
          <Card title="Worker performance on tower complaints" flush>
            <DataTable
              rows={report.workerRows}
              columns={workerColumns}
              caption="Worker performance on tower complaints"
              emptyTitle="No assignments yet"
              emptyMessage="No worker has been assigned to a complaint in your tower."
            />
          </Card>
        </>
      )}
    </>
  );
}
