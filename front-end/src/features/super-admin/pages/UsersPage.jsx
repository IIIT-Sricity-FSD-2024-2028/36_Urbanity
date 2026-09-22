import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, ConfirmDialog, ErrorState, Input, LoadingState, Modal, Select, useToast } from "../../../components/ui/index.js";
import { DataTable, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { ROLES } from "../../../constants/roles.js";
import { useAsyncResource } from "../hooks/useAsyncResource.js";
import { superAdminService } from "../services/superAdminService.js";
import { associationLabel, formatEnum } from "../utils/formatters.js";

const roleValues = Object.values(ROLES);
const emptyForm = { name: "", email: "", phone: "", password: "", role: ROLES.COMMUNITY_ADMIN, associationId: "" };

function UserModal({ user, directory, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(user ? { name: user.name || "", email: user.email || "", phone: user.phone || "", password: "", role: user.role, associationId: "" } : emptyForm);
  const [saving, setSaving] = useState(false);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const association = form.role === ROLES.TOWER_REPRESENTATIVE ? { key: "towerId", label: "Tower", items: directory.towers } : form.role === ROLES.RESIDENT ? { key: "apartmentId", label: "Apartment", items: directory.apartments } : [ROLES.COMMUNITY_ADMIN, ROLES.MAINTENANCE_WORKER].includes(form.role) ? { key: "communityId", label: "Community", items: directory.communities } : null;
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const base = { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() };
      if (user) { if (form.password) base.password = form.password; await superAdminService.updateUser(user.id, base); }
      else { base.password = form.password; base.role = form.role; if (association) base[association.key] = form.associationId; await superAdminService.createUser(base); }
      showToast({ type: "success", message: user ? "User updated." : "User created." }); await onSaved(); onClose();
    } catch (error) { showToast({ type: "error", message: error.message }); } finally { setSaving(false); }
  };
  return <Modal isOpen onClose={onClose} title={user ? "Edit user" : "Create user"} size="lg" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="user-form" loading={saving}>Save</Button></>}>
    <form id="user-form" className="sa-form sa-form--grid" onSubmit={submit}>
      <Input label="Name" value={form.name} onChange={update("name")} required /><Input label="Email" type="email" value={form.email} onChange={update("email")} required />
      <Input label="Phone" value={form.phone} onChange={update("phone")} />
      <Input label={user ? "New password" : "Password"} hint={user ? "Leave blank to keep the current password." : undefined} type="password" value={form.password} onChange={update("password")} required={!user} />
      {!user && <><Select label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, associationId: "" })} required>{roleValues.map((role) => <option key={role} value={role}>{formatEnum(role)}</option>)}</Select>
        {association && <Select label={association.label} value={form.associationId} onChange={update("associationId")} required><option value="">Select {association.label.toLowerCase()}</option>{association.items.map((item) => <option key={item.id} value={item.id}>{item.name || item.label || item.apartmentNumber || item.code || item.id}</option>)}</Select>}</>}
      {user && <p className="sa-form__wide sa-muted">Role and hierarchy association remain unchanged because the current update contract does not safely clear prior associations.</p>}
    </form>
  </Modal>;
}

export function UsersPage() {
  const { user: currentUser, refreshUser } = useAuth(); const { showToast } = useToast();
  const loader = useCallback(async () => { const [users, communities, towers, floors, apartments] = await Promise.all([superAdminService.listUsers(), superAdminService.listCommunities(), superAdminService.listTowers(), superAdminService.listFloors(), superAdminService.listApartments()]); return { users, communities, towers, floors, apartments }; }, []);
  const { data, loading, error, reload } = useAsyncResource(loader);
  const [creating, setCreating] = useState(false); const [editing, setEditing] = useState(null); const [removing, setRemoving] = useState(null); const [deleting, setDeleting] = useState(false);
  const columns = useMemo(() => [
    { key: "name", header: "Name" }, { key: "email", header: "Email" }, { key: "role", header: "Role", render: (value) => <StatusBadge status={value} label={formatEnum(value)} /> },
    { key: "scope", header: "Scope", render: (_, row) => associationLabel(row, data) },
    { key: "actions", header: "Actions", render: (_, row) => <div className="sa-actions"><Button variant="secondary" onClick={() => setEditing(row)}>Edit</Button><Button variant="danger" disabled={row.id === currentUser.id} onClick={() => setRemoving(row)}>Delete</Button></div> },
  ], [currentUser.id, data]);
  const afterSave = async () => { await reload(); if (editing?.id === currentUser.id) await refreshUser(); };
  const remove = async () => { setDeleting(true); try { await superAdminService.deleteUser(removing.id); showToast({ type: "success", message: "User deleted." }); setRemoving(null); await reload(); } catch (requestError) { showToast({ type: "error", message: requestError.message }); } finally { setDeleting(false); } };
  return <>
    <PageHeader eyebrow="Access" title="Platform users" description="Create users with backend-supported role and hierarchy associations." actions={<Button onClick={() => setCreating(true)}>Create user</Button>} />
    {loading && <LoadingState message="Loading users..." />}{error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <Card flush><DataTable rows={data.users} columns={columns} caption="Platform users" emptyTitle="No users found" /></Card>}
    {creating && <UserModal directory={data} onClose={() => setCreating(false)} onSaved={reload} />}
    {editing && <UserModal key={editing.id} user={editing} directory={data} onClose={() => setEditing(null)} onSaved={afterSave} />}
    <ConfirmDialog isOpen={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={remove} loading={deleting} title="Delete user" message={`Delete ${removing?.name || "this user"}? This cannot be undone.`} confirmLabel="Delete" />
  </>;
}
