import { useState } from "react";
import { Button, Card, ErrorState, Input, LoadingState, Select } from "../../../components/ui/index.js";
import { PageHeader } from "../../../components/data-display/index.js";
import { useWorkerResource } from "../hooks/useWorkerResource.js";
import { maintenanceWorkerService as service } from "../services/maintenanceWorkerService.js";
import { COMPLETED_STATUSES, formatLabel, matchesTask } from "../utils/workflow.js";
import { TaskTable } from "./TaskTable.jsx";

export function TaskList({ completed = false }) {
  const { data, loading, error, reload } = useWorkerResource(service.getTasks);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const available = (data || []).filter((task) => !completed || COMPLETED_STATUSES.includes(task.status));
  const statuses = [...new Set(available.map((task) => task.status).filter(Boolean))];
  const tasks = available.filter((task) => (!status || task.status === status) && matchesTask(task, query));
  return <>
    <PageHeader eyebrow="Maintenance workspace" title={completed ? "Completed work" : "Assigned tasks"}
      description={completed ? "Submitted work, including tasks awaiting authority verification. Open a task to view its proof." : "Your assigned complaints. Search by task, work type, or location."}
      actions={<Button variant="secondary" onClick={reload} loading={loading}>Refresh</Button>} />
    {loading && <LoadingState message="Loading assigned work..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && !error && <Card title={`${tasks.length} tasks`}>
      <div className="mw-filters">
        <Input label="Search tasks" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {[...new Set([...statuses, ...(status ? [status] : [])])].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
        </Select>
      </div>
      <TaskTable tasks={tasks} completed={completed} />
    </Card>}
  </>;
}
