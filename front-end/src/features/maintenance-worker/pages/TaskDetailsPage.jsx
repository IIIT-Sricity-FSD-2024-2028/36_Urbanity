import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { useWorkerResource } from "../hooks/useWorkerResource.js";
import { useWorkerMutation } from "../hooks/useWorkerMutation.js";
import { maintenanceWorkerService as service } from "../services/maintenanceWorkerService.js";
import { formatDate, formatLabel, locationLabel } from "../utils/workflow.js";
import { AttachmentGallery } from "../components/AttachmentGallery.jsx";
import { ResolutionForm } from "../components/ResolutionForm.jsx";

function TaskDetails({ id }) {
  const loader = useCallback(async (signal) => {
    const [task, profile, attachments] = await Promise.all([
      service.getTask(id, signal), service.getProfile(signal), service.getAttachments(id, signal),
    ]);
    if (!task || !profile) throw new Error("Task details are unavailable.");
    return { task, profile, attachments };
  }, [id]);
  const { data, loading, error, reload } = useWorkerResource(loader);
  const mutation = useWorkerMutation();
  const task = data?.task;
  const assignedToMe = task && task.assignedWorkerId === data.profile.id && task.communityId === data.profile.communityId;
  const disabled = loading || Boolean(error) || mutation.pending;
  return <>
    <PageHeader eyebrow="Assigned work" title={task?.title || "Task details"}
      actions={<Button variant="secondary" onClick={reload} disabled={mutation.pending} loading={loading}>Refresh</Button>} />
    <p><Link to={ROUTES.MAINTENANCE_WORKER_TASKS}>Back to assigned tasks</Link></p>
    {loading && <LoadingState message="Loading task details..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {task && <div className="mw-stack">
      <Card title="Complaint details" actions={<StatusBadge status={task.status} />}>
        <p className="mw-description">{task.description || "No description provided."}</p>
        <dl className="mw-details">
          <div><dt>Complaint ID</dt><dd>{task.id}</dd></div>
          <div><dt>Type</dt><dd>{formatLabel(task.type)}</dd></div>
          <div><dt>Work type</dt><dd>{formatLabel(task.requiredWorkType)}</dd></div>
          <div><dt>Location</dt><dd>{locationLabel(task)}</dd></div>
          <div><dt>Responsible authority</dt><dd>{task.responsibleUserName || "Not available"}</dd></div>
          <div><dt>Assigned worker ID</dt><dd>{task.assignedWorkerId || "Not available"}</dd></div>
          <div><dt>Submitted</dt><dd>{formatDate(task.createdAt)}</dd></div>
          <div><dt>Last updated</dt><dd>{formatDate(task.updatedAt)}</dd></div>
        </dl>
        {assignedToMe && task.status === "ASSIGNED" && <div className="mw-actions">
          <Button loading={mutation.pending} disabled={disabled} onClick={() => mutation.run(() => service.startWork(id), "Work started.", reload)}>Start work</Button>
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
        <div><dt>Submitted by worker</dt><dd>{task.resolutionProof.submittedByWorkerId}</dd></div>
        <div><dt>Verification</dt><dd>{task.resolutionVerification ? `${task.resolutionVerification.verifiedByUserName} · ${task.resolutionVerification.authorityRating} / 5` : "Awaiting authority verification"}</dd></div>
        {task.resolutionVerification && <div><dt>Verified</dt><dd>{formatDate(task.resolutionVerification.verifiedAt)}</dd></div>}
      </dl>
        <h3 className="mw-actions">Submitted proof images</h3>
        <AttachmentGallery taskId={id} attachments={data.attachments.filter((item) => task.resolutionProof.attachmentIds?.includes(item.id))} />
      </Card>}
      <Card title="Complaint and work images"><AttachmentGallery taskId={id} attachments={data.attachments} /></Card>
      {assignedToMe && task.status === "IN_PROGRESS" && <ResolutionForm taskId={id} attachments={data.attachments} disabled={disabled} reload={reload} />}
    </div>}
  </>;
}

export function TaskDetailsPage() {
  const { id } = useParams();
  // A new task owns a new request/form lifecycle, even on direct detail-to-detail navigation.
  return <TaskDetails key={id} id={id} />;
}
