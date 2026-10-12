import { useCallback } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { ComplaintAttachments } from "../components/ComplaintAttachments.jsx";
import { ComplaintReview } from "../components/ComplaintReview.jsx";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";
import { dateTime, label, locationText } from "../utils.js";

function ComplaintDetails({ id }) {
  const loader = useCallback(() => residentService.getComplaint(id), [id]);
  const { data: complaint, loading, error, reload } = useResidentResource(loader);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const failures = location.state?.uploadFailures || [];

  return <div className="resident-stack">
    <PageHeader title="Complaint details" actions={<><Link className="ui-button ui-button--secondary" to={ROUTES.RESIDENT_COMPLAINTS}>Back to complaints</Link><Button variant="secondary" onClick={reload} disabled={loading}>Refresh</Button></>} />
    {failures.length > 0 && <Card title="Complaint created; some images need attention">
      <p>Your complaint was saved. Select these files again in Complaint images to retry their upload.</p>
      <ul>{failures.map((message, index) => <li key={index}>{message}</li>)}</ul>
      <Button variant="secondary" onClick={() => navigate(location.pathname, { replace: true, state: null })}>Dismiss</Button>
    </Card>}
    {loading && <LoadingState message="Loading complaint..." />}
    {error && <ErrorState title="Complaint unavailable" message={error.message} onRetry={reload} />}
    {complaint && <>
      <Card title={complaint.title} actions={<StatusBadge status={complaint.status} />}>
        <p className="resident-prose">{complaint.description}</p>
        <dl className="resident-facts">
          {[["Complaint ID", complaint.id], ["Type", label(complaint.type)], ["Work type", label(complaint.requiredWorkType)],
            ["Location", locationText(complaint.location)], ["Responsible authority", complaint.responsibleUserName || label(complaint.responsibleRole)],
            ["Worker assignment", complaint.assignedWorkerId ? "Worker assigned" : "Not assigned yet"],
            ["Submitted", dateTime(complaint.createdAt)], ["Last updated", dateTime(complaint.updatedAt)],
          ].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
        </dl>
      </Card>
      <Card title="Status history">
        {complaint.statusHistory?.length ? <ol className="resident-history">{complaint.statusHistory.map((entry, index) => <li key={`${entry.changedAt}-${index}`}>
          <StatusBadge status={entry.status} /><span>{dateTime(entry.changedAt)}</span><span className="resident-muted">{label(entry.changedByRole)}</span>
        </li>)}</ol> : <EmptyState title="No status history available" />}
      </Card>
      {complaint.resolutionProof && <Card title="Resolution details"><dl className="resident-facts">
        <div><dt>Problem found</dt><dd className="resident-prose">{complaint.resolutionProof.problemFound}</dd></div>
        <div><dt>Work completed</dt><dd className="resident-prose">{complaint.resolutionProof.resolutionSummary}</dd></div>
        <div><dt>Submitted for verification</dt><dd>{dateTime(complaint.resolutionProof.submittedAt)}</dd></div>
        {complaint.resolutionVerification && <div><dt>Verified</dt><dd>{dateTime(complaint.resolutionVerification.verifiedAt)} by {complaint.resolutionVerification.verifiedByUserName}</dd></div>}
      </dl></Card>}
      {complaint.residentId === user?.id && <ComplaintAttachments complaintId={id} onUploaded={reload} />}
      <ComplaintReview complaint={complaint} onReviewed={reload} />
    </>}
  </div>;
}

export function ComplaintDetailsPage() {
  const { id } = useParams();
  return <ComplaintDetails key={id} id={id} />;
}
