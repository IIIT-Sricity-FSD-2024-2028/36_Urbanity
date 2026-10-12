import { Link } from "react-router-dom";
import { DataTable, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { dateTime, locationText } from "../utils.js";

const columns = [
  { key: "title", header: "Complaint", render: (title, item) => <div className="resident-complaint-cell">
    <Link to={`${ROUTES.RESIDENT_COMPLAINTS}/${item.id}`}>{title}</Link>
    <small>{item.id}</small><p>{item.description}</p>
  </div> },
  { key: "status", header: "Status", render: (status) => <StatusBadge status={status} /> },
  { key: "location", header: "Location", render: locationText },
  { key: "createdAt", header: "Submitted", render: dateTime },
  { key: "updatedAt", header: "Updated", render: dateTime },
];

export function ComplaintList({ complaints, filtered = false }) {
  return <DataTable columns={columns} rows={complaints} caption="Your maintenance complaints"
    emptyTitle={filtered ? "No matching complaints" : "No complaints yet"}
    emptyMessage={filtered ? "Try a different search or status filter." : "Your maintenance requests will appear here after you submit a complaint."} />;
}
