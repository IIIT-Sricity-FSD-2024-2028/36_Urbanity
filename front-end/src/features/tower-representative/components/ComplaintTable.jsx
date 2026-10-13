import { Link } from "react-router-dom";
import { DataTable, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { apartmentLabel, formatDate, formatEnum } from "../utils/formatters.js";
import { nextAuthorityAction } from "../utils/workflow.js";

export function ComplaintTable({ complaints, user, caption, emptyTitle = "No complaints", emptyMessage }) {
  const columns = [
    {
      key: "title",
      header: "Complaint",
      render: (value, row) => (
        <div className="tr-cell-stack"><strong>{value}</strong></div>
      ),
    },
    { key: "location", header: "Apartment", accessor: (row) => apartmentLabel(row) },
    { key: "type", header: "Type", render: formatEnum },
    { key: "status", header: "Status", render: (value) => <StatusBadge status={value} /> },
    { key: "requiredWorkType", header: "Work type", render: formatEnum },
    { key: "createdAt", header: "Created", render: formatDate },
    {
      key: "action",
      header: <span className="sr-only">Actions</span>,
      render: (_, row) => {
        const next = nextAuthorityAction(row, user);
        return (
          <Link
            className={`ui-button ui-button--${next ? "primary" : "secondary"} tr-link-button`}
            to={`${ROUTES.TOWER_REPRESENTATIVE_COMPLAINTS}/${row.id}`}
          >
            {next ? next.label : "View details"}
          </Link>
        );
      },
    },
  ];

  return (
    <DataTable
      rows={complaints}
      columns={columns}
      caption={caption}
      emptyTitle={emptyTitle}
      emptyMessage={emptyMessage}
    />
  );
}
