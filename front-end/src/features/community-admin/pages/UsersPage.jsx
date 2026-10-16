import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Select,
  useToast,
} from "../../../components/ui/index.js";
import { DataTable, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { ROLES } from "../../../constants/roles.js";
import { useCommunityResource } from "../hooks/useCommunityResource.js";
import { communityAdminService } from "../services/communityAdminService.js";
import { entityName, formatEnum } from "../utils.js";

const roles = [ROLES.TOWER_REPRESENTATIVE, ROLES.MAINTENANCE_WORKER, ROLES.RESIDENT];
const workTypes = ["PLUMBING", "ELECTRICAL", "CARPENTRY", "HVAC", "LIFT_MAINTENANCE", "CLEANING", "GENERAL_MAINTENANCE"];

function initialForm(user, data) {
  const apartment = user?.apartmentId ? data.apartments.find((item) => item.id === user.apartmentId) : null;
  const floor = apartment ? data.floors.find((item) => item.id === apartment.floorId) : null;

  return {
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    password: "",
    role: user?.role || "",
    towerId: user?.towerId || floor?.towerId || "",
    floorId: floor?.id || "",
    apartmentId: user?.apartmentId || "",
    residentSituation: "OWNER_OCCUPANT",
    specialization: "",
  };
}

function validateForm(form, editing) {
  const errors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  const phone = form.phone.trim();

  if (!name) errors.name = "Enter the user's full name.";
  else if (name.length > 100) errors.name = "Name must be 100 characters or fewer.";

  if (!email) errors.email = "Enter an email address.";
  else if (email.length > 100) errors.email = "Email must be 100 characters or fewer.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";

  if (phone.length > 20) errors.phone = "Phone number must be 20 characters or fewer.";

  if (!editing && !form.password) errors.password = "Create a password for this account.";
  else if (form.password && form.password.length < 8) errors.password = "Password must contain at least 8 characters.";
  else if (form.password.length > 128) errors.password = "Password must be 128 characters or fewer.";

  if (!editing && !form.role) errors.role = "Select a role.";
  if (form.role === ROLES.TOWER_REPRESENTATIVE && !form.towerId) errors.towerId = "Select the tower this representative manages.";
  if (form.role === ROLES.MAINTENANCE_WORKER && !form.specialization && !editing) errors.specialization = "Select the worker's specialization.";
  if (form.role === ROLES.RESIDENT) {
    if (!form.towerId) errors.towerId = "Select the resident's tower.";
    if (!form.floorId) errors.floorId = "Select the resident's floor.";
    if (!form.apartmentId) errors.apartmentId = "Select the resident's apartment.";
  }

  return errors;
}

function buildUserPayload(form, editing) {
  const payload = {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
  };

  if (form.password) payload.password = form.password;
  if (editing) return payload;

  payload.role = form.role;
  if (form.role === ROLES.TOWER_REPRESENTATIVE) payload.towerId = form.towerId;
  if (form.role === ROLES.RESIDENT) {payload.apartmentId = form.apartmentId;payload.residentSituation=form.residentSituation;}
  return payload;
}

async function createMaintenanceWorker(userPayload, specialization) {
  const createdUser = await communityAdminService.createUser(userPayload);

  try {
    await communityAdminService.createWorker({ userId: createdUser.id, specialization });
  } catch (profileError) {
    try {
      const workers = await communityAdminService.listWorkers();
      if (workers.some((worker) => worker.userId === createdUser.id)) return;
      await communityAdminService.deleteUser(createdUser.id);
    } catch {
      throw new Error("The worker account was created, but its profile could not be confirmed. Refresh the user and workforce lists before trying again.");
    }
    throw new Error(`${profileError.message} The incomplete worker account was removed.`);
  }
}

function UserModal({ user, data, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => initialForm(user, data));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(user);
  const floors = useMemo(() => data.floors.filter((floor) => floor.towerId === form.towerId), [data.floors, form.towerId]);
  const apartments = useMemo(() => data.apartments.filter((apartment) => apartment.floorId === form.floorId), [data.apartments, form.floorId]);

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const changeRole = (event) => {
    const role = event.target.value;
    setForm((current) => ({ ...current, role, towerId: "", floorId: "", apartmentId: "", specialization: "" }));
    setErrors({});
  };

  const changeTower = (event) => {
    const towerId = event.target.value;
    setForm((current) => ({ ...current, towerId, floorId: "", apartmentId: "" }));
    setErrors((current) => ({ ...current, towerId: undefined, floorId: undefined, apartmentId: undefined }));
  };

  const changeFloor = (event) => {
    const floorId = event.target.value;
    setForm((current) => ({ ...current, floorId, apartmentId: "" }));
    setErrors((current) => ({ ...current, floorId: undefined, apartmentId: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(form, editing);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = buildUserPayload(form, editing);
      if (editing) {
        await communityAdminService.updateUser(user.id, payload);
        if (user.role === ROLES.RESIDENT && form.apartmentId !== user.apartmentId) await communityAdminService.associateResident(user.id, form.apartmentId);
        if (user.role === ROLES.TOWER_REPRESENTATIVE && form.towerId !== user.towerId) await communityAdminService.associateRepresentative(user.id, form.towerId);
      } else if (form.role === ROLES.MAINTENANCE_WORKER) {
        await createMaintenanceWorker(payload, form.specialization);
      } else {
        await communityAdminService.createUser(payload);
      }

      showToast({ type: "success", message: editing ? "User updated." : "User created." });
      await onSaved();
      onClose();
    } catch (error) {
      showToast({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  return <Modal isOpen onClose={onClose} title={editing ? "Edit community user" : "Create community user"} size="lg" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="community-user-form" loading={saving}>Save</Button></>}>
    <form id="community-user-form" className="ca-form ca-form--grid ca-user-form" onSubmit={submit} noValidate>
      {!editing && <div className="ca-user-form__wide ca-user-form__intro"><p>Choose the account role first. The required assignment fields will update automatically.</p></div>}
      {!editing && <div className="ca-user-form__wide">{!editing && form.role === ROLES.RESIDENT && <Select label="Resident relationship" value={form.residentSituation} onChange={(event) => setForm((current) => ({...current,residentSituation:event.target.value}))}><option value="OWNER_OCCUPANT">Owner-occupant (record ownership)</option><option value="TENANT_PENDING">Prospective tenant (no occupancy until active lease)</option></Select>}
        <Select label="Role" value={form.role} onChange={changeRole} error={errors.role} required><option value="">Select role</option>{roles.map((role) => <option key={role} value={role}>{formatEnum(role)}</option>)}</Select></div>}
      <div className="ca-user-form__wide ca-user-form__section"><strong>Account details</strong><span>Contact information and sign-in credentials.</span></div>
      <Input label="Full name" value={form.name} onChange={update("name")} maxLength="100" error={errors.name} required />
      <Input label="Email" type="email" value={form.email} onChange={update("email")} maxLength="100" error={errors.email} required />
      <Input label="Phone" type="tel" value={form.phone} onChange={update("phone")} maxLength="20" error={errors.phone} />
      <Input label={editing ? "New password" : "Password"} hint={editing ? "Leave blank to keep the current password." : "Use at least 8 characters."} type="password" minLength="8" maxLength="128" value={form.password} onChange={update("password")} error={errors.password} required={!editing} />

      {form.role && <div className="ca-user-form__wide ca-user-form__section"><strong>{form.role === ROLES.RESIDENT ? "Resident address" : form.role === ROLES.TOWER_REPRESENTATIVE ? "Tower assignment" : "Worker profile"}</strong><span>{form.role === ROLES.RESIDENT ? "Select the resident's exact home in your community." : form.role === ROLES.TOWER_REPRESENTATIVE ? "Select the tower this representative will manage." : "Select the worker's supported maintenance specialization."}</span></div>}
      {form.role === ROLES.TOWER_REPRESENTATIVE && <Select label="Tower" value={form.towerId} onChange={changeTower} error={errors.towerId} required><option value="">Select tower</option>{data.towers.map((tower) => <option key={tower.id} value={tower.id}>{tower.name}</option>)}</Select>}

      {form.role === ROLES.MAINTENANCE_WORKER && !editing && <Select label="Specialization" value={form.specialization} onChange={update("specialization")} error={errors.specialization} required><option value="">Select specialization</option>{workTypes.map((type) => <option key={type} value={type}>{formatEnum(type)}</option>)}</Select>}

      {form.role === ROLES.RESIDENT && <>
        <Select label="Tower" value={form.towerId} onChange={changeTower} error={errors.towerId} required><option value="">Select tower</option>{data.towers.map((tower) => <option key={tower.id} value={tower.id}>{tower.name}</option>)}</Select>
        <Select label="Floor" value={form.floorId} onChange={changeFloor} error={errors.floorId} disabled={!form.towerId} required><option value="">{form.towerId ? "Select floor" : "Select a tower first"}</option>{floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.label || `Floor ${floor.floorNumber}`}</option>)}</Select>
        <Select label="Apartment" value={form.apartmentId} onChange={update("apartmentId")} error={errors.apartmentId} disabled={!form.floorId} required><option value="">{form.floorId ? "Select apartment" : "Select a floor first"}</option>{apartments.map((apartment) => <option key={apartment.id} value={apartment.id}>{apartment.label || apartment.apartmentNumber}</option>)}</Select>
      </>}
    </form>
  </Modal>;
}

export function UsersPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const { showToast } = useToast();
  const loader = useCallback(async () => {
    const [users, towers, floors, apartments] = await Promise.all([communityAdminService.listUsers(), communityAdminService.listTowers(), communityAdminService.listFloors(), communityAdminService.listApartments()]);
    return { users, towers, floors, apartments };
  }, []);
  const { data, loading, error, reload } = useCommunityResource(loader);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const columns = useMemo(() => [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "role", header: "Role", render: (value) => <StatusBadge status={value} label={formatEnum(value)} /> },
    { key: "scope", header: "Association", render: (_, row) => row.apartmentId ? entityName(data.apartments, row.apartmentId) : row.towerId ? entityName(data.towers, row.towerId) : row.communityId ? "Community" : "None" },
    { key: "actions", header: "Actions", render: (_, row) => <div className="ca-actions"><Button variant="secondary" onClick={() => setEditing(row)}>Edit</Button><Button variant="danger" disabled={row.id === currentUser.id} onClick={() => setRemoving(row)}>Delete</Button></div> },
  ], [currentUser.id, data]);

  const afterSave = async () => { await reload(); if (editing?.id === currentUser.id) await refreshUser(); };
  const remove = async () => {
    setDeleting(true);
    try {
      await communityAdminService.deleteUser(removing.id);
      showToast({ type: "success", message: "User deleted." });
      setRemoving(null);
      await reload();
    } catch (error) {
      showToast({ type: "error", message: error.message });
    } finally {
      setDeleting(false);
    }
  };

  return <>
    <PageHeader eyebrow="People and associations" title="Community users" description="Manage residents, tower representatives, and maintenance-worker accounts within your community." actions={<Button onClick={() => setCreating(true)}>Create user</Button>} />
    {loading && <LoadingState message="Loading community users..." />}{error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <Card flush><DataTable rows={data.users} columns={columns} emptyTitle="No community users" caption="Community users" /></Card>}
    {creating && <UserModal data={data} onClose={() => setCreating(false)} onSaved={reload} />}{editing && <UserModal key={editing.id} user={editing} data={data} onClose={() => setEditing(null)} onSaved={afterSave} />}
    <ConfirmDialog isOpen={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={remove} loading={deleting} title="Delete user" message={`Delete ${removing?.name || "this user"}?`} confirmLabel="Delete" />
  </>;
}
