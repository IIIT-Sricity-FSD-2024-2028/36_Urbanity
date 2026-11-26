import { Link, useParams } from "react-router-dom";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader, RatingStars, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { useWorkerMutation } from "../hooks/useWorkerMutation.js";
import { useAuth } from "../../../auth/useAuth.js";
import { ROLES } from "../../../constants/roles.js";
import { ComplaintEstimatePanel } from "../../complaint-estimates/components/ComplaintEstimatePanel.jsx";
import { useComplaintEstimate } from "../../complaint-estimates/services/complaintEstimatesApi.js";
import { useGetMaintenanceWorkerTaskAttachmentsQuery, useGetMaintenanceWorkerTaskQuery, useGetMaintenanceWorkerProfileQuery, useStartMaintenanceWorkerTaskMutation } from "../services/workerTasksApi.js";
import { formatDate, formatLabel, locationLabel } from "../utils/workflow.js";
import { AttachmentGallery } from "../components/AttachmentGallery.jsx";
import { ResolutionForm } from "../components/ResolutionForm.jsx";

function TaskDetails({ id }) {
  const { sessionRevision } = useAuth();
  const taskQuery = useGetMaintenanceWorkerTaskQuery({ id, sessionRevision }, { refetchOnMountOrArgChange: true });
  const profileQuery = useGetMaintenanceWorkerProfileQuery(sessionRevision);
  const attachmentQuery = useGetMaintenanceWorkerTaskAttachmentsQuery({ id, sessionRevision }, { refetchOnMountOrArgChange: true });
  const task = taskQuery.currentData;
  const estimateQuery = useComplaintEstimate(task && task.type !== "COMMUNITY" ? id : undefined, ROLES.MAINTENANCE_WORKER);
  const profile = profileQuery.currentData;
  const attachments = attachmentQuery.currentData;
  const mutation = useWorkerMutation();
  const [startTask] = useStartMaintenanceWorkerTaskMutation();
  const loading = taskQuery.isLoading || profileQuery.isLoading || attachmentQuery.isLoading;
  const reload = () => Promise.all([taskQuery.refetch(), profileQuery.refetch(), attachmentQuery.refetch(),
    ...(!estimateQuery.isUninitialized ? [estimateQuery.refetch()] : [])]);
  const error = taskQuery.error || profileQuery.error || attachmentQuery.error;
  const assignedToMe = task && profile && task.assignedWorkerId === profile.id && task.communityId === profile.communityId;
  const disabled = loading || Boolean(error) || mutation.pending;
  return <>
    <PageHeader eyebrow="Assigned work" title={task?.title || "Task details"}
      actions={<><Link className="ui-button ui-button--secondary" to={ROUTES.MAINTENANCE_WORKER_TASKS}>Back to assigned tasks</Link><Button variant="secondary" onClick={reload} disabled={mutation.pending} loading={loading}>Refresh</Button></>} />
    {loading && <LoadingState message="Loading task details..." />}
    {error && <ErrorState message={error.message || "Task details are unavailable."} onRetry={reload} />}
    {!loading && !error && !task && <EmptyState title="Task not found" description="This complaint is unavailable or is not assigned to your account." />}
    {task && <div className="mw-stack">
      <Card title="Complaint details" actions={<StatusBadge status={task.status} />}>
        <p className="mw-description">{task.description || "No description provided."}</p>
        <dl className="mw-details">
          <div><dt>Type</dt><dd>{formatLabel(task.type)}</dd></div>
          <div><dt>Work type</dt><dd>{formatLabel(task.requiredWorkType)}</dd></div>
          <div><dt>Location</dt><dd>{locationLabel(task)}</dd></div>
          <div><dt>Responsible authority</dt><dd>{task.responsibleUserName || "Not available"}</dd></div>
          <div><dt>Assigned worker</dt><dd>{task.assignedWorkerName || "You"}</dd></div>
          <div><dt>Submitted</dt><dd>{formatDate(task.createdAt)}</dd></div>
          <div><dt>Last updated</dt><dd>{formatDate(task.updatedAt)}</dd></div>
        </dl>
        {assignedToMe && task.status === "ASSIGNED" && <div className="mw-actions">
          <Button loading={mutation.pending} disabled={disabled || (task.type !== "COMMUNITY" && (estimateQuery.isError || !estimateQuery.currentData?.canStartWork))}
            onClick={() => mutation.run(() => startTask({ id, sessionRevision }).unwrap(), "Work started.")}>Start work</Button>
          {task.type !== "COMMUNITY" && !estimateQuery.currentData?.canStartWork && <p>Repair can start after the approved estimate is paid.</p>}
        </div>}
        {mutation.error && <ErrorState message={mutation.error} />}
      </Card>
      <Card title="Status history">
        {task.statusHistory?.length ? <ol className="mw-history">{task.statusHistory.map((entry, index) => <li key={`${entry.status}-${entry.changedAt}-${index}`}>
          <StatusBadge status={entry.status} /> <span>{formatDate(entry.changedAt)} · {formatLabel(entry.changedByRole)}</span>
        </li>)}</ol> : <EmptyState title="No status history" />}
      </Card>
      {task.resolutionProof && <Card title="Resolution submitted"><dl className="mw-details">
        <div><dt>Problem found</dt><dd className="mw-description">{task.resolutionProof.problemFound}</dd></div>
        <div><dt>Resolution summary</dt><dd className="mw-description">{task.resolutionProof.resolutionSummary}</dd></div>
        <div><dt>Proof submitted</dt><dd>{formatDate(task.resolutionProof.submittedAt)}</dd></div>
        <div><dt>Submitted by</dt><dd>You</dd></div>
        <div><dt>Verification</dt><dd>{task.resolutionVerification ? <span>{task.resolutionVerification.verifiedByUserName} · <RatingStars value={task.resolutionVerification.authorityRating} /></span> : "Awaiting authority verification"}</dd></div>
        {task.resolutionVerification && <div><dt>Verified</dt><dd>{formatDate(task.resolutionVerification.verifiedAt)}</dd></div>}
      </dl>
        <h3 className="mw-actions">Submitted proof images</h3>
        <AttachmentGallery taskId={id} attachments={(attachments || []).filter((item) => task.resolutionProof.attachmentIds?.includes(item.id))} />
      </Card>}
      <Card title="Complaint and work images"><AttachmentGallery taskId={id} attachments={attachments || []} /></Card>
      {assignedToMe && <ComplaintEstimatePanel id={id} role={ROLES.MAINTENANCE_WORKER} />}
      {assignedToMe && task.status === "IN_PROGRESS" && <ResolutionForm taskId={id} attachments={attachments || []} disabled={disabled} />}
    </div>}
  </>;
}

export function TaskDetailsPage() {
  const { id } = useParams();
  // A new task owns a new request/form lifecycle, even on direct detail-to-detail navigation.
  return <TaskDetails key={id} id={id} />;
}
