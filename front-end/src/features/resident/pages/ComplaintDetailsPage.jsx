import { useCallback } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader, RatingStars, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { ComplaintAttachments } from "../components/ComplaintAttachments.jsx";
import { ComplaintReview } from "../components/ComplaintReview.jsx";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";
import { dateTime, label, locationText, STATUS_GUIDANCE, STATUS_LABELS } from "../utils.js";

function ComplaintDetails({ id }) {
  const loader = useCallback(() => residentService.getComplaint(id), [id]);
  const { data: complaint, loading, error, reload } = useResidentResource(loader);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const failures = location.state?.uploadFailures || [];

  return <div className="resident-stack">
    <PageHeader title={complaint?.title || "Complaint details"} description={complaint ? locationText(complaint.location) : "Follow your report from submission to resolution."} actions={<><Link className="ui-button ui-button--secondary" to={ROUTES.RESIDENT_COMPLAINTS}>Back to complaints</Link><Button variant="secondary" onClick={reload} disabled={loading}>Refresh</Button></>} />
    {failures.length > 0 && <Card title="Complaint created; some images need attention">
      <p>Your complaint was saved. Select these files again in Complaint images to retry their upload.</p>
      <ul>{failures.map((message, index) => <li key={index}>{message}</li>)}</ul>
      <Button variant="secondary" onClick={() => navigate(location.pathname, { replace: true, state: null })}>Dismiss</Button>
    </Card>}
    {loading && <LoadingState message="Loading complaint..." />}
    {error && <ErrorState title="Complaint unavailable" message={error.message} onRetry={reload} />}
    {complaint && <>
      <section className="resident-status-summary" aria-label="Current complaint status"><StatusBadge status={complaint.status} label={STATUS_LABELS[complaint.status]} /><p>{STATUS_GUIDANCE[complaint.status]}</p></section>
      <div className="resident-details-layout">
      <div className="resident-stack">
      <Card title="The reported issue">
        <p className="resident-prose">{complaint.description}</p>
        <dl className="resident-facts">
          {[["Type", label(complaint.type)], ["Work type", label(complaint.requiredWorkType)],
            ["Location", locationText(complaint.location)], ["Responsible authority", complaint.responsibleUserName || label(complaint.responsibleRole)],
            ["Worker assignment", complaint.assignedWorkerName || (complaint.assignedWorkerId ? "Worker assigned" : "Not assigned yet")],
            ["Submitted", dateTime(complaint.createdAt)], ["Last updated", dateTime(complaint.updatedAt)],
          ].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
        </dl>
      </Card>
      {complaint.resolutionProof && <Card title="Resolution details"><dl className="resident-facts">
        <div><dt>Problem found</dt><dd className="resident-prose">{complaint.resolutionProof.problemFound}</dd></div>
        <div><dt>Work completed</dt><dd className="resident-prose">{complaint.resolutionProof.resolutionSummary}</dd></div>
        <div><dt>Submitted for verification</dt><dd>{dateTime(complaint.resolutionProof.submittedAt)}</dd></div>
        {complaint.resolutionVerification && <div><dt>Verified</dt><dd>{dateTime(complaint.resolutionVerification.verifiedAt)} by {complaint.resolutionVerification.verifiedByUserName}</dd></div>}
        {complaint.resolutionVerification && <div><dt>Work-quality rating</dt><dd><RatingStars value={complaint.resolutionVerification.authorityRating} /></dd></div>}
      </dl></Card>}
      {complaint.residentId === user?.id && <ComplaintAttachments complaintId={id} onUploaded={reload} />}
      <ComplaintReview complaint={complaint} onReviewed={reload} />
      </div>
      <aside className="resident-stack">
        <Card title="Repair timeline">
          <p className="resident-note">Updates recorded for this complaint.</p>
          {complaint.statusHistory?.length ? <ol className="resident-history">{complaint.statusHistory.map((entry, index) => <li key={`${entry.changedAt}-${index}`} className={index === complaint.statusHistory.length - 1 ? "resident-history-current" : ""}>
            <strong>{STATUS_LABELS[entry.status] || label(entry.status)}</strong>
            <span>{dateTime(entry.changedAt)}</span><span className="resident-muted">{label(entry.changedByRole)}</span>
          </li>)}</ol> : <EmptyState title="No status history available" />}
        </Card>
        <section className="resident-how-it-works"><h2>Your maintenance team</h2><dl className="resident-facts resident-facts-single"><div><dt>Responsible authority</dt><dd>{complaint.responsibleUserName || label(complaint.responsibleRole)}</dd></div><div><dt>Assigned worker</dt><dd>{complaint.assignedWorkerName || "Not assigned yet"}</dd></div></dl><p className="resident-note">The authority checks the worker's proof before the repair is marked as verified.</p></section>
      </aside>
      </div>
    </>}
  </div>;
}

export function ComplaintDetailsPage() {
  const { id } = useParams();
  return <ComplaintDetails key={id} id={id} />;
}
