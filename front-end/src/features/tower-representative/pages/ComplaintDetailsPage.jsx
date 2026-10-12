import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, ConfirmDialog, ErrorState, LoadingState, useToast } from "../../../components/ui/index.js";
import { PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { AssignWorkerModal } from "../components/AssignWorkerModal.jsx";
import { AttachmentList } from "../components/AttachmentList.jsx";
import { VerifyResolutionModal } from "../components/VerifyResolutionModal.jsx";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { formatDateTime, formatEnum, formatRating, shortId, workerReference } from "../utils/formatters.js";
import { isResponsibleAuthority, lifecycleGuidance, nextAuthorityAction } from "../utils/workflow.js";

const REVIEW_STATUSES = new Set(["REVIEWED", "CLOSED"]);

const TRANSITIONS = {
  review: {
    title: "Start review",
    message: "Move this complaint to Under Review? It can then be assigned to an eligible worker.",
    confirmLabel: "Start review",
    success: "Complaint moved to Under Review.",
    run: (id) => towerRepresentativeService.startReview(id),
  },
  close: {
    title: "Close complaint",
    message: "Close this complaint? Closing completes its lifecycle and cannot be undone from this portal.",
    confirmLabel: "Close complaint",
    success: "Complaint closed.",
    run: (id) => towerRepresentativeService.closeComplaint(id),
  },
};

const settledValue = (result) => (result.status === "fulfilled" ? result.value : null);

export function ComplaintDetailsPage() {
  const { complaintId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dialog, setDialog] = useState(null);
  const [transitioning, setTransitioning] = useState(false);

  const loader = useCallback(async () => {
    const complaint = await towerRepresentativeService.getComplaint(complaintId);
    const [attachments, review, worker, resident] = await Promise.allSettled([
      towerRepresentativeService.listComplaintAttachments(complaintId),
      REVIEW_STATUSES.has(complaint.status) ? towerRepresentativeService.getComplaintReview(complaintId) : Promise.resolve(null),
      complaint.assignedWorkerId ? towerRepresentativeService.getWorker(complaint.assignedWorkerId) : Promise.resolve(null),
      complaint.residentId ? towerRepresentativeService.getResidentHierarchy(complaint.residentId) : Promise.resolve(null),
    ]);
    return {
      complaint,
      attachments: settledValue(attachments) || [],
      attachmentsFailed: attachments.status === "rejected",
      review: settledValue(review),
      worker: settledValue(worker),
      resident: settledValue(resident),
    };
  }, [complaintId]);
  const { data, error, initialLoading, reload } = useTowerResource(loader);

  const closeDialog = useCallback(() => setDialog(null), []);

  const runTransition = async () => {
    const transition = TRANSITIONS[dialog];
    if (!transition) return;
    setTransitioning(true);
    try {
      await transition.run(complaintId);
      showToast({ type: "success", message: transition.success });
      setDialog(null);
      await reload();
    } catch (requestError) {
      showToast({ type: "error", message: requestError.message || "Unable to update the complaint." });
    } finally {
      setTransitioning(false);
    }
  };

  const backLink = <Link className="ui-button ui-button--secondary tr-link-button" to={ROUTES.TOWER_REPRESENTATIVE_COMPLAINTS}>Back to complaints</Link>;

  if (initialLoading) return <LoadingState message="Loading complaint..." />;
  if (error || !data) {
    return (
      <>
        <PageHeader eyebrow="Complaint" title="Complaint unavailable" actions={backLink} />
        <Card><ErrorState message={error?.message || "Unable to load this complaint."} onRetry={reload} /></Card>
      </>
    );
  }

  const { complaint, attachments, review, worker, resident } = data;
  const next = nextAuthorityAction(complaint, user);
  const responsible = isResponsibleAuthority(complaint, user);
  const proofIds = new Set(complaint.resolutionProof?.attachmentIds || []);
  const proofAttachments = attachments.filter((item) => item.purpose === "RESOLUTION_PROOF" || proofIds.has(item.id));
  const complaintAttachments = attachments.filter((item) => !proofAttachments.includes(item));
  const history = complaint.statusHistory || [];
  const transition = TRANSITIONS[dialog];

  return (
    <>
      <PageHeader
        eyebrow={`Complaint #${shortId(complaint.id)}`}
        title={complaint.title}
        description={`${formatEnum(complaint.type)} complaint · ${complaint.location?.towerName || "Tower"} · ${complaint.location?.apartmentNumber || "Apartment unavailable"}`}
        actions={backLink}
      />

      <div className="tr-detail-layout">
        <div className="tr-detail-main">
          <Card title="Next step" className="tr-next-step">
            <div className="tr-next-step__body">
              <StatusBadge status={complaint.status} />
              <p>{lifecycleGuidance(complaint.status)}</p>
            </div>
            {next && (
              <div className="tr-actions">
                <Button onClick={() => setDialog(next.action)}>{next.label}</Button>
              </div>
            )}
            {!responsible && (
              <p className="tr-muted tr-note">
                {complaint.responsibleUserName || "Another authority"} is the responsible authority for this complaint, so workflow actions are not available to you.
              </p>
            )}
          </Card>

          <Card title="Complaint details">
            <p className="tr-description">{complaint.description || "No description provided."}</p>
            <dl className="tr-details">
              <div><dt>Status</dt><dd><StatusBadge status={complaint.status} /></dd></div>
              <div><dt>Type</dt><dd>{formatEnum(complaint.type)}</dd></div>
              <div><dt>Required work</dt><dd>{formatEnum(complaint.requiredWorkType)}</dd></div>
              <div><dt>Responsible authority</dt><dd>{complaint.responsibleUserName || "Not assigned"} ({formatEnum(complaint.responsibleRole)})</dd></div>
              <div><dt>Created</dt><dd>{formatDateTime(complaint.createdAt)}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDateTime(complaint.updatedAt)}</dd></div>
            </dl>
          </Card>

          {complaint.resolutionProof && (
            <Card title="Resolution proof">
              <dl className="tr-details tr-details--single">
                <div><dt>Problem found</dt><dd>{complaint.resolutionProof.problemFound}</dd></div>
                <div><dt>Resolution summary</dt><dd>{complaint.resolutionProof.resolutionSummary}</dd></div>
                <div><dt>Submitted</dt><dd>{formatDateTime(complaint.resolutionProof.submittedAt)}</dd></div>
              </dl>
              <h3 className="tr-subheading">Proof images</h3>
              <AttachmentList complaintId={complaint.id} attachments={proofAttachments} emptyMessage="No proof images are available." />
              <div className="tr-verification">
                {complaint.resolutionVerification ? (
                  <p>
                    Verified by <strong>{complaint.resolutionVerification.verifiedByUserName}</strong> on {formatDateTime(complaint.resolutionVerification.verifiedAt)} · Work-quality rating {formatRating(complaint.resolutionVerification.authorityRating)}
                  </p>
                ) : (
                  <p className="tr-muted">Awaiting verification by the responsible authority.</p>
                )}
              </div>
            </Card>
          )}

          <Card title="Complaint attachments">
            {data.attachmentsFailed
              ? <p className="tr-muted">Attachments could not be loaded. Refresh the page to try again.</p>
              : <AttachmentList complaintId={complaint.id} attachments={complaintAttachments} emptyMessage="The resident did not attach any images." />}
          </Card>

          {REVIEW_STATUSES.has(complaint.status) && (
            <Card title="Resident review">
              {review ? (
                <>
                  <dl className="tr-details">
                    <div><dt>Overall</dt><dd>{formatRating(review.rating)}</dd></div>
                    <div><dt>Speed</dt><dd>{formatRating(review.speedRating)}</dd></div>
                    <div><dt>Quality</dt><dd>{formatRating(review.qualityRating)}</dd></div>
                    <div><dt>Communication</dt><dd>{formatRating(review.communicationRating)}</dd></div>
                  </dl>
                  {review.feedback && <blockquote className="tr-quote">{review.feedback}</blockquote>}
                  <p className="tr-muted">Submitted {formatDateTime(review.createdAt)}</p>
                </>
              ) : (
                <p className="tr-muted">The resident review could not be loaded.</p>
              )}
            </Card>
          )}
        </div>

        <aside className="tr-detail-side">
          <Card title="Resident & location">
            <dl className="tr-details tr-details--single">
              <div><dt>Resident</dt><dd>{resident?.user?.name || "Not available"}</dd></div>
              {resident?.user?.email && <div><dt>Email</dt><dd>{resident.user.email}</dd></div>}
              {resident?.user?.phone && <div><dt>Phone</dt><dd>{resident.user.phone}</dd></div>}
              <div><dt>Apartment</dt><dd>{complaint.location?.apartmentNumber || "Not available"}</dd></div>
              <div><dt>Floor</dt><dd>{complaint.location?.floorLabel || "Not available"}</dd></div>
              <div><dt>Tower</dt><dd>{complaint.location?.towerName || "Not available"}</dd></div>
            </dl>
          </Card>

          <Card title="Assigned worker">
            {complaint.assignedWorkerId ? (
              <dl className="tr-details tr-details--single">
                <div><dt>Worker profile</dt><dd>{workerReference(worker || { id: complaint.assignedWorkerId })}</dd></div>
                {worker && <div><dt>Specialization</dt><dd>{formatEnum(worker.specialization)}</dd></div>}
                {worker && <div><dt>Availability</dt><dd><StatusBadge status={worker.status} /></dd></div>}
                {worker && <div><dt>Rating</dt><dd>{formatRating(worker.rating)} · {worker.completedWorkCount || 0} completed</dd></div>}
              </dl>
            ) : (
              <p className="tr-muted">No worker has been assigned yet.</p>
            )}
          </Card>

          <Card title="Status history">
            {history.length ? (
              <ol className="tr-timeline">
                {history.map((entry, index) => (
                  <li key={`${entry.status}-${entry.changedAt}-${index}`} className={index === history.length - 1 ? "tr-timeline__item--current" : undefined}>
                    <StatusBadge status={entry.status} />
                    <span className="tr-muted">{formatDateTime(entry.changedAt)} · {formatEnum(entry.changedByRole)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="tr-muted">No status history is available.</p>
            )}
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        isOpen={Boolean(transition)}
        onClose={closeDialog}
        onConfirm={runTransition}
        loading={transitioning}
        title={transition?.title}
        message={transition?.message}
        confirmLabel={transition?.confirmLabel}
        confirmVariant="primary"
      />
      {dialog === "assign" && <AssignWorkerModal complaint={complaint} onClose={closeDialog} onAssigned={reload} />}
      {dialog === "verify" && <VerifyResolutionModal complaint={complaint} onClose={closeDialog} onVerified={reload} />}
    </>
  );
}
