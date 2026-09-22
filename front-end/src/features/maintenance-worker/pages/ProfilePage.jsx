import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { useWorkerResource } from "../hooks/useWorkerResource.js";
import { maintenanceWorkerService as service } from "../services/maintenanceWorkerService.js";
import { formatDate, formatLabel } from "../utils/workflow.js";

export function ProfilePage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useWorkerResource(service.getProfile);
  return <>
    <PageHeader eyebrow="Account" title="My worker profile" description="Your service profile is managed by your community administrator."
      actions={<Button variant="secondary" loading={loading} onClick={reload}>Refresh</Button>} />
    {loading && <LoadingState message="Loading worker profile..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && !error && <Card title="Worker details"><dl className="mw-details">
      <div><dt>Email</dt><dd>{user?.email || "Not available"}</dd></div>
      <div><dt>Role</dt><dd>Maintenance Worker</dd></div>
      <div><dt>Worker ID</dt><dd>{data.id}</dd></div>
      <div><dt>Community ID</dt><dd>{data.communityId}</dd></div>
      <div><dt>Specialization</dt><dd>{formatLabel(data.specialization)}</dd></div>
      <div><dt>Work status</dt><dd><StatusBadge status={data.status} /></dd></div>
      <div><dt>Rating</dt><dd>{data.rating ?? "Not available"} / 5</dd></div>
      <div><dt>Reviewed completed work</dt><dd>{data.completedWorkCount ?? "Not available"}</dd></div>
      <div><dt>Verified work history count</dt><dd>{Array.isArray(data.workHistory) ? data.workHistory.length : "Not available"}</dd></div>
      <div><dt>Created</dt><dd>{formatDate(data.createdAt)}</dd></div>
      <div><dt>Updated</dt><dd>{formatDate(data.updatedAt)}</dd></div>
    </dl></Card>}
  </>;
}
