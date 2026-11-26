import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../../../components/data-display/index.js";
import { Button, Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { ROLES } from "../../../constants/roles.js";
import { ROUTES } from "../../../constants/routes.js";
import { estimateStatusLabel, formatEstimateAmount, formatEstimateDate } from "../estimateModel.js";
import { useComplaintEstimateQueue } from "../services/complaintEstimatesApi.js";
import { ComplaintEstimatePanel } from "./ComplaintEstimatePanel.jsx";

const columns = [
  { key: "complaint", header: "Complaint", accessor: ({ complaint }) => complaint.title },
  { key: "worker", header: "Worker", accessor: ({ complaint }) => complaint.workerName },
  { key: "total", header: "Estimate", accessor: ({ estimate }) => formatEstimateAmount(estimate.totalPaise) },
  { key: "status", header: "Status", render: estimateStatusLabel },
];

const adminGroups = [
  ["Pending payment approval", "PENDING_COMMUNITY_ADMIN_APPROVAL"],
  ["Ready for mock payment", "APPROVED_FOR_PAYMENT"],
  ["Mock payment history", "PAID"],
  ["Rejected payment requests", "REJECTED_BY_ADMIN"],
];

export function ComplaintEstimateQueue({ role }) {
  const query = useComplaintEstimateQueue(role);
  const [selected, setSelected] = useState(null);
  const details = useRef(null);
  const admin = role === ROLES.COMMUNITY_ADMIN;
  const groups = admin ? adminGroups : [["Pending tower verification", "PENDING_TOWER_VERIFICATION"]];
  const open = (id) => {
    setSelected(id);
    details.current?.focus();
  };
  const actionColumn = {
    key: "review",
    header: "Details",
    render: (_, { complaint }) => admin
      ? <Button variant="secondary" onClick={() => open(complaint.id)} aria-label={`Review ${complaint.title}`}>View</Button>
      : <Link to={`${ROUTES.TOWER_REPRESENTATIVE_COMPLAINTS}/${complaint.id}`}>Review estimate</Link>,
  };
  const title = admin ? "Worker mock payments" : "Estimates to verify";
  return (
    <Card className="estimate-queue" title={title} actions={
      <Button variant="secondary" onClick={query.refetch} disabled={query.isFetching}>Refresh estimates</Button>
    }>
      {query.isError && <ErrorState message={query.error.message} onRetry={query.refetch} />}
      {query.isLoading && <LoadingState message="Loading estimates..." />}
      {query.currentData && !query.isError && groups.map(([label, status]) => {
        const historyColumns = status === "PAID" ? [
          { key: "reference", header: "Mock reference", accessor: ({ payment }) => payment.reference },
          { key: "paidAt", header: "Completed", accessor: ({ payment }) => formatEstimateDate(payment.paidAt) },
        ] : [];
        return <section className="estimate-queue__group" key={status}>
          {admin && <h3>{label}</h3>}
          <DataTable rows={query.currentData.filter((record) => record.status === status)} rowKey={({ complaint }) => complaint.id}
            columns={[...columns, ...historyColumns, actionColumn]} caption={label}
            emptyTitle={status === "PAID" ? "No completed mock payments" : "No requests in this stage"} />
        </section>;
      })}
      {admin && <div ref={details} tabIndex={-1} className="estimate-queue__details" aria-label="Selected estimate">
        {selected && <>
          <Button variant="secondary" onClick={() => setSelected(null)}>Close estimate details</Button>
          <ComplaintEstimatePanel key={selected} id={selected} role={role} />
        </>}
      </div>}
    </Card>
  );
}
