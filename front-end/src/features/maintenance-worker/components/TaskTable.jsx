import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/ui/index.js";
import { StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { formatDate, formatLabel, locationLabel } from "../utils/workflow.js";

export function TaskTable({ tasks, completed = false }) {
  if (!tasks.length) return <EmptyState title="No tasks found" message="No assigned tasks match this view." />;
  return <ul className="mw-task-list" aria-label={completed ? "Completed maintenance work" : "Assigned maintenance tasks"}>
    {tasks.map((task) => <li key={task.id}>
      <div className="mw-task-list__heading"><Link to={`${ROUTES.MAINTENANCE_WORKER_TASKS}/${encodeURIComponent(task.id)}`}>{task.title || "Untitled complaint"}</Link><StatusBadge status={task.status} /></div>
      <p className="mw-task-list__location">{locationLabel(task)}</p>
      <p className="mw-summary">{task.description}</p>
      <div className="mw-task-list__footer"><div><span>{formatLabel(task.requiredWorkType)}</span><span>{completed ? "Proof submitted" : "Submitted"} {formatDate(completed ? task.resolutionProof?.submittedAt : task.createdAt)}</span></div><Link className="ui-button ui-button--secondary" to={`${ROUTES.MAINTENANCE_WORKER_TASKS}/${encodeURIComponent(task.id)}`} aria-label={`Open task: ${task.title || "Untitled complaint"}`}>Open task</Link></div>
    </li>)}
  </ul>;
}
