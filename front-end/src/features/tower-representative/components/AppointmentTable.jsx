import { Link } from "react-router-dom";
import { DataTable, StatusBadge } from "../../../components/data-display/index.js";
import { Badge } from "../../../components/ui/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { formatVisit, hasSlotStarted } from "../utils/appointments.js";
import { apartmentLabel } from "../utils/formatters.js";

// UI convenience only: the backend independently enforces responsible-authority checks.
export function nextAppointmentAction(appointment, user) {
  if (!user?.id || appointment.complaint?.responsibleUserId !== user.id) return null;
  if (appointment.status === "REQUESTED") return "Confirm visit";
  if (appointment.status === "RESCHEDULE_REQUESTED") return "Process reschedule";
  if (appointment.status === "CONFIRMED" && hasSlotStarted(appointment) && !appointment.arrivedAt) return "Review visit";
  return null;
}

export function AppointmentTable({ appointments, user, caption, emptyTitle, emptyMessage }) {
  const columns = [
    {
      key: "complaint",
      header: "Complaint",
      render: (complaint) => (
        <div className="tr-cell-stack">
          <strong>{complaint?.title || "Complaint"}</strong>
          {complaint?.isEmergency && <span><Badge variant="danger">Emergency</Badge></span>}
          <span className="tr-muted">{apartmentLabel(complaint)}</span>
        </div>
      ),
    },
    {
      key: "visit",
      header: "Visit",
      accessor: (row) => row,
      render: (row) => (
        <div className="tr-cell-stack">
          <span>{row.scheduledDate ? formatVisit(row.scheduledDate, row.scheduledTimeSlot) : formatVisit(row.requestedDate, row.requestedTimeSlot)}</span>
          <span className="tr-muted">{row.scheduledDate ? "Scheduled" : "Resident preference"}</span>
        </div>
      ),
    },
    { key: "workerName", header: "Worker", render: (value) => value || <span className="tr-muted">Not assigned</span> },
    { key: "status", header: "Status", render: (value) => <StatusBadge status={value} /> },
    {
      key: "action",
      header: <span className="sr-only">Actions</span>,
      render: (_, row) => {
        const next = nextAppointmentAction(row, user);
        return (
          <Link className={`ui-button ui-button--${next ? "primary" : "secondary"} tr-link-button`} to={`${ROUTES.TOWER_REPRESENTATIVE_APPOINTMENTS}/${row.id}`}>
            {next || "View details"}
          </Link>
        );
      },
    },
  ];
  return <DataTable rows={appointments} columns={columns} caption={caption} emptyTitle={emptyTitle} emptyMessage={emptyMessage} />;
}
