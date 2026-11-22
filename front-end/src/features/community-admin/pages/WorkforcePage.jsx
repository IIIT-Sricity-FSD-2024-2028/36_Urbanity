import { useMemo, useRef, useState } from "react";
import { useAppDispatch } from "../../../app/reduxHooks.js";
import { Button, Card, ConfirmDialog, ErrorState, LoadingState, Modal, Select, useToast } from "../../../components/ui/index.js";
import { DataTable, PageHeader, RatingStars, StatusBadge } from "../../../components/data-display/index.js";
import { ROLES } from "../../../constants/roles.js";
import { useCommunityDirectory } from "../hooks/useCommunityDirectory.js";
import { mutateCommunityDirectory } from "../services/communityDirectoryApi.js";
import { formatEnum } from "../utils.js";

const workTypes = ["PLUMBING", "ELECTRICAL", "CARPENTRY", "HVAC", "LIFT_MAINTENANCE", "CLEANING", "GENERAL_MAINTENANCE"];
const statuses = ["AVAILABLE", "ON_LEAVE", "INACTIVE"];

function WorkerModal({ worker, data, onClose }) {
  const dispatch = useAppDispatch();
  const submitting = useRef(false);
  const { showToast } = useToast(); const [userId, setUserId] = useState(""); const [specialization, setSpecialization] = useState(worker?.specialization || workTypes[0]); const [status, setStatus] = useState(worker?.status || "AVAILABLE"); const [saving, setSaving] = useState(false);
  const profileUsers = new Set(data.workers.map((item) => item.userId)); const candidates = data.users.filter((item) => item.role === ROLES.MAINTENANCE_WORKER && !profileUsers.has(item.id));
  const submit = async (event) => { event.preventDefault(); if (submitting.current) return; submitting.current = true; setSaving(true); try { if (worker) { const payload = { specialization }; if (worker.status !== "BUSY") payload.status = status; await mutateCommunityDirectory(dispatch, "updateCommunityAdminWorker", { id: worker.id, changes: payload }); } else await mutateCommunityDirectory(dispatch, "createCommunityAdminWorker", { userId, specialization }); showToast({ type: "success", message: worker ? "Worker profile updated." : "Worker profile created." }); onClose(); } catch (error) { showToast({ type: "error", message: error.message }); } finally { submitting.current = false; setSaving(false); } };
  return <Modal isOpen onClose={saving ? undefined : onClose} title={worker ? "Edit worker profile" : "Create worker profile"} footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="worker-form" loading={saving}>Save</Button></>}><form id="worker-form" className="ca-form" onSubmit={submit}>
    {!worker && <Select label="Maintenance-worker account" value={userId} onChange={(event) => setUserId(event.target.value)} required><option value="">Select account</option>{candidates.map((user) => <option key={user.id} value={user.id}>{user.name} — {user.email}</option>)}</Select>}
    <Select label="Specialization" value={specialization} onChange={(event) => setSpecialization(event.target.value)}>{workTypes.map((type) => <option key={type} value={type}>{formatEnum(type)}</option>)}</Select>
    {worker && (worker.status === "BUSY" ? <p className="ca-muted">Busy status is controlled by complaint assignments.</p> : <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{formatEnum(item)}</option>)}</Select>)}
  </form></Modal>;
}

export function WorkforcePage() {
  const dispatch = useAppDispatch();
  const deletingRef = useRef(false);
  const { showToast } = useToast();
  const { data, loading, error, reload } = useCommunityDirectory(["workers", "users"]);
  const [editing, setEditing] = useState(null); const [removing, setRemoving] = useState(null); const [deleting, setDeleting] = useState(false);
  const rows = useMemo(() => (data?.workers || []).map((worker) => ({ ...worker, user: data.users.find((item) => item.id === worker.userId) })), [data]);
  const columns = [{ key: "user", header: "Worker", render: (value) => value?.name || "Unknown account" }, { key: "email", header: "Email", render: (_, row) => row.user?.email || "Unavailable" }, { key: "specialization", header: "Specialization", render: formatEnum }, { key: "status", header: "Status", render: (value) => <StatusBadge status={value} /> }, { key: "rating", header: "Rating", render: (value) => <RatingStars value={value} /> }, { key: "completedWorkCount", header: "Completed" }, { key: "actions", header: "Actions", render: (_, row) => <div className="ca-actions"><Button variant="secondary" onClick={() => setEditing(row)}>Edit</Button><Button variant="danger" disabled={row.status === "INACTIVE"} onClick={() => setRemoving(row)}>Deactivate</Button></div> }];
  const deactivate = async () => { if (deletingRef.current || !removing) return; deletingRef.current = true; setDeleting(true); try { await mutateCommunityDirectory(dispatch, "deactivateCommunityAdminWorker", removing.id); showToast({ type: "success", message: "Worker profile deactivated." }); setRemoving(null); } catch (error) { showToast({ type: "error", message: error.message }); } finally { deletingRef.current = false; setDeleting(false); } };
  return <><PageHeader eyebrow="Maintenance operations" title="Workforce" description="Maintain worker profiles scoped to your community." />{loading && <LoadingState message="Loading workforce..." />}{error && <ErrorState message={error.message} onRetry={reload} />}{data && <Card flush><DataTable rows={rows} columns={columns} emptyTitle="No worker profiles" /></Card>}{editing && data && <WorkerModal key={editing.id} worker={editing} data={data} onClose={() => setEditing(null)} />}<ConfirmDialog isOpen={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={deactivate} loading={deleting} title="Deactivate worker" message="The account remains available, but its worker profile becomes inactive." confirmLabel="Deactivate" /></>;
}
