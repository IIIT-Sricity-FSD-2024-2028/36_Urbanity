import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, ConfirmDialog, ErrorState, Input, LoadingState, Modal, Select, useToast } from "../../../components/ui/index.js";
import { DataTable, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { ROLES } from "../../../constants/roles.js";
import { useCommunityResource } from "../hooks/useCommunityResource.js";
import { communityAdminService } from "../services/communityAdminService.js";
import { entityName, formatEnum } from "../utils.js";

const roles = [ROLES.RESIDENT, ROLES.TOWER_REPRESENTATIVE, ROLES.MAINTENANCE_WORKER];

function UserModal({ user, data, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", phone: user?.phone || "", password: "", role: user?.role || ROLES.RESIDENT, associationId: user?.apartmentId || user?.towerId || "" });
  const [saving, setSaving] = useState(false);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const association = form.role === ROLES.RESIDENT ? { key: "apartmentId", label: "Apartment", items: data.apartments } : form.role === ROLES.TOWER_REPRESENTATIVE ? { key: "towerId", label: "Tower", items: data.towers } : null;
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const base = { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() };
      if (user) {
        if (form.password) base.password = form.password;
        await communityAdminService.updateUser(user.id, base);
        if (user.role === ROLES.RESIDENT && form.associationId !== user.apartmentId) await communityAdminService.associateResident(user.id, form.associationId);
        if (user.role === ROLES.TOWER_REPRESENTATIVE && form.associationId !== user.towerId) await communityAdminService.associateRepresentative(user.id, form.associationId);
      } else {
        const payload = { ...base, password: form.password, role: form.role };
        if (association) payload[association.key] = form.associationId;
        await communityAdminService.createUser(payload);
      }
      showToast({ type: "success", message: user ? "User updated." : "User created." }); await onSaved(); onClose();
    } catch (error) { showToast({ type: "error", message: error.message }); }
    finally { setSaving(false); }
  };
  return <Modal isOpen onClose={onClose} title={user ? "Edit community user" : "Create community user"} size="lg" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="community-user-form" loading={saving}>Save</Button></>}>
    <form id="community-user-form" className="ca-form ca-form--grid" onSubmit={submit}>
      <Input label="Name" value={form.name} onChange={update("name")} required /><Input label="Email" type="email" value={form.email} onChange={update("email")} required />
      <Input label="Phone" value={form.phone} onChange={update("phone")} /><Input label={user ? "New password" : "Password"} hint={user ? "Leave blank to keep the current password." : undefined} type="password" minLength="8" value={form.password} onChange={update("password")} required={!user} />
      {!user && <Select label="Role" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value, associationId: "" }))} required>{roles.map((role) => <option key={role} value={role}>{formatEnum(role)}</option>)}</Select>}
      {association && <Select label={association.label} value={form.associationId} onChange={update("associationId")} required><option value="">Select {association.label.toLowerCase()}</option>{association.items.map((item) => <option key={item.id} value={item.id}>{item.name || item.label || item.apartmentNumber}</option>)}</Select>}
    </form>
  </Modal>;
}

export function UsersPage() {
  const { user: currentUser, refreshUser } = useAuth(); const { showToast } = useToast();
  const loader = useCallback(async () => { const [users, towers, apartments] = await Promise.all([communityAdminService.listUsers(), communityAdminService.listTowers(), communityAdminService.listApartments()]); return { users, towers, apartments }; }, []);
  const { data, loading, error, reload } = useCommunityResource(loader);
  const [creating, setCreating] = useState(false); const [editing, setEditing] = useState(null); const [removing, setRemoving] = useState(null); const [deleting, setDeleting] = useState(false);
  const columns = useMemo(() => [{ key: "name", header: "Name" }, { key: "email", header: "Email" }, { key: "role", header: "Role", render: (value) => <StatusBadge status={value} label={formatEnum(value)} /> }, { key: "scope", header: "Association", render: (_, row) => row.apartmentId ? entityName(data.apartments, row.apartmentId) : row.towerId ? entityName(data.towers, row.towerId) : row.communityId ? "Community" : "None" }, { key: "actions", header: "Actions", render: (_, row) => <div className="ca-actions"><Button variant="secondary" onClick={() => setEditing(row)}>Edit</Button><Button variant="danger" disabled={row.id === currentUser.id} onClick={() => setRemoving(row)}>Delete</Button></div> }], [currentUser.id, data]);
  const afterSave = async () => { await reload(); if (editing?.id === currentUser.id) await refreshUser(); };
  const remove = async () => { setDeleting(true); try { await communityAdminService.deleteUser(removing.id); showToast({ type: "success", message: "User deleted." }); setRemoving(null); await reload(); } catch (error) { showToast({ type: "error", message: error.message }); } finally { setDeleting(false); } };
  return <>
    <PageHeader eyebrow="People and associations" title="Community users" description="Manage residents, tower representatives, and maintenance-worker accounts within your community." actions={<Button onClick={() => setCreating(true)}>Create user</Button>} />
    {loading && <LoadingState message="Loading community users..." />}{error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <Card flush><DataTable rows={data.users} columns={columns} emptyTitle="No community users" caption="Community users" /></Card>}
    {creating && <UserModal data={data} onClose={() => setCreating(false)} onSaved={reload} />}{editing && <UserModal key={editing.id} user={editing} data={data} onClose={() => setEditing(null)} onSaved={afterSave} />}
    <ConfirmDialog isOpen={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={remove} loading={deleting} title="Delete user" message={`Delete ${removing?.name || "this user"}?`} confirmLabel="Delete" />
  </>;
}
