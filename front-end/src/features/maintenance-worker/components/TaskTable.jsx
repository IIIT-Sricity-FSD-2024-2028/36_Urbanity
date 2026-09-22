import { Link } from "react-router-dom";
import { DataTable, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { formatDate, formatLabel, locationLabel } from "../utils/workflow.js";

export function TaskTable({ tasks, completed = false }) {
  const columns = [
    { key: "title", header: "Task", render: (_, task) => <>
      <Link to={`${ROUTES.MAINTENANCE_WORKER_TASKS}/${encodeURIComponent(task.id)}`}>{task.title || "Untitled complaint"}</Link>
      <small className="mw-secondary">{task.id}</small>
      <p className="mw-summary">{task.description}</p>
    </> },
    { key: "location", header: "Location", render: (_, task) => locationLabel(task) },
    { key: "requiredWorkType", header: "Work type", render: formatLabel },
    { key: "status", header: "Status", render: (status) => <StatusBadge status={status} /> },
    { key: "assignedWorkerId", header: "Assigned worker", render: (id) => id || "Not available" },
    { key: "createdAt", header: completed ? "Proof submitted" : "Submitted", render: (_, task) => formatDate(completed ? task.resolutionProof?.submittedAt : task.createdAt) },
  ];
  return <DataTable columns={columns} rows={tasks} rowKey="id" caption={completed ? "Completed maintenance work" : "Assigned maintenance tasks"}
    emptyTitle="No tasks found" emptyMessage="No assigned tasks match this view." />;
}
