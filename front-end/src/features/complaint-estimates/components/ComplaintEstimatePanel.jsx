import { Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { DataTable, StatusBadge } from "../../../components/data-display/index.js";
import { ROLES } from "../../../constants/roles.js";
import { categories, estimateStatusLabel, formatEstimateAmount, formatEstimateDate } from "../estimateModel.js";
import { useComplaintEstimate } from "../services/complaintEstimatesApi.js";
import { EstimateActions } from "./EstimateActions.jsx";
import { EstimateForm } from "./EstimateForm.jsx";
import "../complaint-estimates.css";

const costColumns = [
  { key: "category", header: "Category", render: (category) => categories[category] },
  { key: "description", header: "Description" },
  { key: "quantity", header: "Quantity" },
  { key: "unitPricePaise", header: "Unit price", render: formatEstimateAmount },
  { key: "subtotalPaise", header: "Subtotal", render: formatEstimateAmount },
];

const auditLabels = {
  CANCEL_ESTIMATE: "Estimate cancelled and worker released",
  SUBMIT_ESTIMATE: "Estimate submitted",
  TOWER_APPROVE: "Estimate verified by tower",
  TOWER_REJECT: "Estimate rejected by tower",
  TOWER_RETURN: "Estimate returned for revision",
  ADMIN_APPROVE: "Payment approved",
  ADMIN_REJECT: "Payment rejected",
  MOCK_PAYMENT_INITIATED: "Mock payment initiated",
  MOCK_PAYMENT_SUCCEEDED: "Mock payment completed",
};

function Facts({ rows }) {
  return <dl className="estimate-facts">
    {rows.filter(([, value]) => value != null && value !== "").map(([name, value]) => (
      <div key={name}><dt>{name}</dt><dd>{value}</dd></div>
    ))}
  </dl>;
}

function EstimateDetails({ estimate }) {
  return <>
    <Facts rows={[
      ["Estimate ID", estimate.id],
      ["Site inspection", estimate.inspection],
      ["Proposed resolution", estimate.proposedResolution],
      ["Supporting notes", estimate.notes],
      ["Estimated completion time", `${estimate.completionHours} hours`],
      ["Submitted", formatEstimateDate(estimate.submittedAt)],
    ]} />
    <DataTable rows={estimate.costs} columns={costColumns} caption="Itemized estimate" />
    <p><strong>Estimated total {formatEstimateAmount(estimate.totalPaise)}</strong></p>
  </>;
}

function PaymentReceipt({ payment }) {
  return <section className="estimate-receipt">
    <h3>Mock payment receipt</h3>
    <p>Simulation completed. No money was transferred.</p>
    <Facts rows={[
      ["Transaction reference", payment.reference],
      ["Amount", formatEstimateAmount(payment.amountPaise)],
      ["Completed", formatEstimateDate(payment.paidAt)],
    ]} />
  </section>;
}

export function ComplaintEstimatePanel({ id, role, onAssignmentReleased }) {
  const query = useComplaintEstimate(id, role);
  const record = query.currentData;
  if (query.isError && (!record || [401, 403, 404].includes(query.error.status))) return <Card title="Estimate and mock payment">
    <ErrorState message={query.error.message} onRetry={query.refetch} />
  </Card>;
  if (query.isLoading) return <LoadingState message="Loading estimate progress..." />;
  if (!record?.available) return null;

  const { estimate, payment, complaint } = record;
  const resident = role === ROLES.RESIDENT;
  const admin = role === ROLES.COMMUNITY_ADMIN;
  const verification = estimate?.audit.find((event) => event.action === "TOWER_APPROVE");
  const feedback = estimate?.audit.filter((event) => event.reason).at(-1);
  const events = record.history?.flatMap(({ audit }) => audit);
  return (
    <Card title={resident ? "Estimate and payment progress" : admin ? "Estimate and payment review" : "Estimate and mock payment"}>
      <div className="estimate-content">
        {query.isError && <ErrorState message={query.error.message} onRetry={query.refetch} />}
        <p role="status">{estimateStatusLabel(record.status)}</p>
        {resident ? (
          <p>{record.assigned ? "Maintenance worker assigned." : "Waiting for a maintenance worker to be assigned."}</p>
        ) : (
          <>
            {admin && <>
              <h3>{complaint.title}</h3>
              <p className="estimate-description">{complaint.description}</p>
              <Facts rows={[
                ["Complaint ID", complaint.id],
                ["Complaint status", <StatusBadge status={complaint.status} />],
                ["Location", complaint.location && `${complaint.location.communityName} · ${complaint.location.towerName} · ${complaint.location.apartmentNumber}`],
                ["Resident", complaint.residentName],
                ["Assigned worker", complaint.workerName],
                ["Verified by", verification?.actorName],
                ["Verified on", verification && formatEstimateDate(verification.timestamp)],
              ]} />
            </>}
            {estimate && <EstimateDetails estimate={estimate} />}
            {!estimate && !record.canSubmit && <EmptyState title="No estimate available" />}
            {feedback && <p className="estimate-description"><strong>Latest feedback from {feedback.actorName}</strong><br />{feedback.reason}</p>}
            {record.canSubmit && <EstimateForm key={record.previousEstimateId || id} id={id} estimate={estimate}
              previousEstimateId={record.previousEstimateId} refreshing={query.isFetching} />}
            {payment && <PaymentReceipt payment={payment} />}
            <EstimateActions key={`${estimate?.id}-${record.status}`} record={record} role={role} refreshing={query.isFetching}
              onAssignmentReleased={onAssignmentReleased} />
            {events?.length > 0 && <details className="estimate-history">
              <summary>Estimate history</summary>
              <ol>
                {record.assignmentHistory?.map((assignment) => <li key={assignment.assignmentId}>
                  {assignment.action === "REASSIGN_WORKER" ? "Replacement worker assigned" : "Worker assigned"} · {formatEstimateDate(assignment.timestamp)}
                </li>)}
                {events.map((event) => <li key={`${event.estimateId}-${event.action}`}>
                  {auditLabels[event.action]} · {event.actorName} · {formatEstimateDate(event.timestamp)}
                  {event.reason && <p className="estimate-description">{event.reason}</p>}
                </li>)}
              </ol>
            </details>}
          </>
        )}
      </div>
    </Card>
  );
}
