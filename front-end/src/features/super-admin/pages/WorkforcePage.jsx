import { useCallback, useMemo, useState } from "react";
import { Button, Card, ConfirmDialog, ErrorState, LoadingState, Modal, Select, useToast } from "../../../components/ui/index.js";
import { DataTable, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { ROLES } from "../../../constants/roles.js";
import { useAsyncResource } from "../hooks/useAsyncResource.js";
import { superAdminService } from "../services/superAdminService.js";
import { entityName, formatEnum } from "../utils/formatters.js";

const workTypes = ["PLUMBING", "ELECTRICAL", "CARPENTRY", "HVAC", "LIFT_MAINTENANCE", "CLEANING", "GENERAL_MAINTENANCE"];
const editableStatuses = ["AVAILABLE", "ON_LEAVE", "INACTIVE"];

function WorkerModal({ worker, data, onClose, onSaved }) {
  const { showToast } = useToast();
  const [userId, setUserId] = useState(""); const [specialization, setSpecialization] = useState(worker?.specialization || workTypes[0]); const [status, setStatus] = useState(worker?.status === "BUSY" ? "BUSY" : worker?.status || "AVAILABLE"); const [saving, setSaving] = useState(false);
  const existingIds = new Set(data.workers.map((item) => item.userId));
  const candidates = data.users.filter((item) => item.role === ROLES.MAINTENANCE_WORKER && !existingIds.has(item.id));
  const submit = async (event) => { event.preventDefault(); setSaving(true); try {
    if (worker) { const payload = { specialization }; if (worker.status !== "BUSY") payload.status = status; await superAdminService.updateWorker(worker.id, payload); }
    else await superAdminService.createWorker({ userId, specialization });
    showToast({ type: "success", message: worker ? "Worker profile updated." : "Worker profile created." }); await onSaved(); onClose();
  } catch (error) { showToast({ type: "error", message: error.message }); } finally { setSaving(false); } };
  return <Modal isOpen onClose={onClose} title={worker ? "Edit worker profile" : "Create worker profile"} footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="worker-form" loading={saving}>Save</Button></>}>
    <form id="worker-form" className="sa-form" onSubmit={submit}>
      {!worker && <Select label="Maintenance worker user" value={userId} onChange={(e) => setUserId(e.target.value)} required><option value="">Select user</option>{candidates.map((user) => <option key={user.id} value={user.id}>{user.name} — {user.email}</option>)}</Select>}
      <Select label="Specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} required>{workTypes.map((type) => <option key={type} value={type}>{formatEnum(type)}</option>)}</Select>
      {worker && (worker.status === "BUSY" ? <p className="sa-muted">Busy status is managed by the assignment workflow and cannot be changed here.</p> : <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>{editableStatuses.map((item) => <option key={item} value={item}>{formatEnum(item)}</option>)}</Select>)}
    </form>
  </Modal>;
}

export function WorkforcePage() {
  const { showToast } = useToast();
  const loader = useCallback(async () => { const [workers, users, communities] = await Promise.all([superAdminService.listWorkers(), superAdminService.listUsers(), superAdminService.listCommunities()]); return { workers, users, communities }; }, []);
  const { data, loading, error, reload } = useAsyncResource(loader);
  const [creating, setCreating] = useState(false); const [editing, setEditing] = useState(null); const [removing, setRemoving] = useState(null); const [deleting, setDeleting] = useState(false);
  const rows = useMemo(() => (data?.workers || []).map((worker) => ({ ...worker, user: data.users.find((item) => item.id === worker.userId) })), [data]);
  const columns = [
    { key: "user", header: "Worker", render: (value) => value?.name || "Unknown user" }, { key: "email", header: "Email", render: (_, row) => row.user?.email || "Unavailable" },
    { key: "communityId", header: "Community", render: (value) => entityName(data.communities, value) }, { key: "specialization", header: "Specialization", render: formatEnum },
    { key: "status", header: "Status", render: (value) => <StatusBadge status={value} /> },
    { key: "actions", header: "Actions", render: (_, row) => <div className="sa-actions"><Button variant="secondary" onClick={() => setEditing(row)}>Edit</Button><Button variant="danger" disabled={row.status === "INACTIVE"} onClick={() => setRemoving(row)}>Deactivate</Button></div> },
  ];
  const deactivate = async () => { setDeleting(true); try { await superAdminService.deactivateWorker(removing.id); showToast({ type: "success", message: "Worker profile deactivated." }); setRemoving(null); await reload(); } catch (requestError) { showToast({ type: "error", message: requestError.message }); } finally { setDeleting(false); } };
  return <>
    <PageHeader eyebrow="Operations" title="Workforce" description="Maintain community-scoped worker profiles and availability." actions={<Button onClick={() => setCreating(true)}>Create worker profile</Button>} />
    {loading && <LoadingState message="Loading workforce..." />}{error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <Card flush><DataTable rows={rows} columns={columns} caption="Maintenance workforce" emptyTitle="No worker profiles" /></Card>}
    {creating && <WorkerModal data={data} onClose={() => setCreating(false)} onSaved={reload} />}
    {editing && <WorkerModal key={editing.id} worker={editing} data={data} onClose={() => setEditing(null)} onSaved={reload} />}
    <ConfirmDialog isOpen={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={deactivate} loading={deleting} title="Deactivate worker" message="The profile will remain in the system with INACTIVE status." confirmLabel="Deactivate" />
  </>;
}
