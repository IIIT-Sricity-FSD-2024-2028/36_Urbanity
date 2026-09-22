import { Link } from "react-router-dom";
import { Button, Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { MetricCard, PageHeader } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { useWorkerResource } from "../hooks/useWorkerResource.js";
import { maintenanceWorkerService as service } from "../services/maintenanceWorkerService.js";
import { VERIFIED_STATUSES } from "../utils/workflow.js";
import { TaskTable } from "../components/TaskTable.jsx";

export function DashboardPage() {
  const { data, loading, error, reload } = useWorkerResource(service.getTasks);
  return <>
    <PageHeader eyebrow="Maintenance workspace" title="Maintenance dashboard" description="Review your assignments and submit completed work for verification."
      actions={<Button variant="secondary" onClick={reload} loading={loading}>Refresh</Button>} />
    {loading && <LoadingState message="Loading your dashboard..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && !error && <>
      <div className="mw-metrics">
        <MetricCard label="Assigned / pending start" value={data.filter((task) => task.status === "ASSIGNED").length} />
        <MetricCard label="In progress" value={data.filter((task) => task.status === "IN_PROGRESS").length} />
        <MetricCard label="Awaiting verification" value={data.filter((task) => task.status === "PENDING_VERIFICATION").length} />
        <MetricCard label="Verified completion" value={data.filter((task) => VERIFIED_STATUSES.includes(task.status)).length} hint="Resolved, reviewed, or closed" />
      </div>
      <Card title="Recent assigned work" actions={<Link to={ROUTES.MAINTENANCE_WORKER_TASKS}>View all tasks</Link>}>
        <TaskTable tasks={[...data].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, 5)} />
      </Card>
    </>}
  </>;
}
