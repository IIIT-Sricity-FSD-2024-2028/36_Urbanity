import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, ConfirmDialog, ErrorState, Input, LoadingState, Modal, Select, useToast } from "../../../components/ui/index.js";
import { DataTable, PageHeader, RatingStars, StatusBadge } from "../../../components/data-display/index.js";
import { ROLES } from "../../../constants/roles.js";
import { useAsyncResource } from "../hooks/useAsyncResource.js";
import { superAdminService } from "../services/superAdminService.js";
import { associationLabel, formatEnum } from "../utils/formatters.js";

const roleValues = Object.values(ROLES);
const workTypes = ["PLUMBING", "ELECTRICAL", "CARPENTRY", "HVAC", "LIFT_MAINTENANCE", "CLEANING", "GENERAL_MAINTENANCE"];

function optionLabel(item) {
  return item.name || item.label || item.apartmentNumber || item.number || item.code || "Unnamed association";
}

function initialForm(user, directory) {
  const apartment = user?.apartmentId ? directory.apartments.find((item) => item.id === user.apartmentId) : null;
  const floor = apartment ? directory.floors.find((item) => item.id === apartment.floorId) : null;
  const towerId = user?.towerId || floor?.towerId || "";
  const tower = towerId ? directory.towers.find((item) => item.id === towerId) : null;

  return {
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    password: "",
    role: user?.role || "",
    communityId: user?.communityId || tower?.communityId || "",
    towerId,
    floorId: floor?.id || "",
    apartmentId: user?.apartmentId || "",
    specialization: "",
  };
}

function validateForm(form, { directory, editing, user }) {
  const errors = {};
  const name = form.name.trim();
  const email = form.email.trim().toLowerCase();
  const phone = form.phone.trim();

  if (!name) errors.name = "Enter the user's full name.";
  else if (name.length > 100) errors.name = "Name must be 100 characters or fewer.";

  if (!email) errors.email = "Enter an email address.";
  else if (email.length > 100) errors.email = "Email must be 100 characters or fewer.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  else if (directory.users.some((item) => item.id !== user?.id && item.email.toLowerCase() === email)) errors.email = "A user with this email already exists.";

  if (phone.length > 20) errors.phone = "Phone number must be 20 characters or fewer.";
  if (!editing && !form.password) errors.password = "Create a password for this account.";
  else if (form.password && form.password.length < 8) errors.password = "Password must contain at least 8 characters.";
  else if (form.password.length > 128) errors.password = "Password must be 128 characters or fewer.";

  if (editing) return errors;
  if (!roleValues.includes(form.role)) {
    errors.role = "Select a supported role.";
    return errors;
  }

  if ([ROLES.COMMUNITY_ADMIN, ROLES.MAINTENANCE_WORKER, ROLES.TOWER_REPRESENTATIVE, ROLES.RESIDENT].includes(form.role)) {
    if (!form.communityId) errors.communityId = "Select a community.";
    else if (!directory.communities.some((item) => item.id === form.communityId)) errors.communityId = "Select a valid community.";
  }

  if ([ROLES.TOWER_REPRESENTATIVE, ROLES.RESIDENT].includes(form.role)) {
    const tower = directory.towers.find((item) => item.id === form.towerId);
    if (!form.towerId) errors.towerId = "Select a tower.";
    else if (!tower || tower.communityId !== form.communityId) errors.towerId = "Select a tower in the chosen community.";
  }

  if (form.role === ROLES.RESIDENT) {
    const floor = directory.floors.find((item) => item.id === form.floorId);
    const apartment = directory.apartments.find((item) => item.id === form.apartmentId);
    if (!form.floorId) errors.floorId = "Select a floor.";
    else if (!floor || floor.towerId !== form.towerId) errors.floorId = "Select a floor in the chosen tower.";
    if (!form.apartmentId) errors.apartmentId = "Select an apartment.";
    else if (!apartment || apartment.floorId !== form.floorId) errors.apartmentId = "Select an apartment on the chosen floor.";
  }

  if (form.role === ROLES.MAINTENANCE_WORKER && !workTypes.includes(form.specialization)) errors.specialization = "Select a worker specialization.";
  return errors;
}

function buildUserPayload(form, editing) {
  const payload = { name: form.name.trim(), email: form.email.trim().toLowerCase() };
  const phone = form.phone.trim();
  if (phone) payload.phone = phone;
  if (form.password) payload.password = form.password;
  if (editing) return payload;

  payload.role = form.role;
  if ([ROLES.COMMUNITY_ADMIN, ROLES.MAINTENANCE_WORKER].includes(form.role)) payload.communityId = form.communityId;
  else if (form.role === ROLES.TOWER_REPRESENTATIVE) payload.towerId = form.towerId;
  else if (form.role === ROLES.RESIDENT) payload.apartmentId = form.apartmentId;
  return payload;
}

async function createMaintenanceWorker(userPayload, specialization) {
  const createdUser = await superAdminService.createUser(userPayload);
  try {
    await superAdminService.createWorker({ userId: createdUser.id, specialization });
  } catch (profileError) {
    try {
      const workers = await superAdminService.listWorkers();
      if (workers.some((worker) => worker.userId === createdUser.id)) return;
      await superAdminService.deleteUser(createdUser.id);
    } catch {
      throw new Error("The worker account was created, but its profile could not be confirmed. Refresh the user list before trying again.");
    }
    throw new Error(`${profileError.message} The incomplete worker account was removed.`);
  }
}

function UserModal({ user, directory, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => initialForm(user, directory));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(user);
  const towers = useMemo(() => directory.towers.filter((tower) => tower.communityId === form.communityId), [directory.towers, form.communityId]);
  const floors = useMemo(() => directory.floors.filter((floor) => floor.towerId === form.towerId), [directory.floors, form.towerId]);
  const apartments = useMemo(() => directory.apartments.filter((apartment) => apartment.floorId === form.floorId), [directory.apartments, form.floorId]);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError("");
  };
  const changeRole = (event) => {
    setForm((current) => ({ ...current, role: event.target.value, communityId: "", towerId: "", floorId: "", apartmentId: "", specialization: "" }));
    setErrors({});
    setSubmitError("");
  };
  const changeCommunity = (event) => {
    setForm((current) => ({ ...current, communityId: event.target.value, towerId: "", floorId: "", apartmentId: "" }));
    setErrors((current) => ({ ...current, communityId: undefined, towerId: undefined, floorId: undefined, apartmentId: undefined }));
    setSubmitError("");
  };
  const changeTower = (event) => {
    setForm((current) => ({ ...current, towerId: event.target.value, floorId: "", apartmentId: "" }));
    setErrors((current) => ({ ...current, towerId: undefined, floorId: undefined, apartmentId: undefined }));
    setSubmitError("");
  };
  const changeFloor = (event) => {
    setForm((current) => ({ ...current, floorId: event.target.value, apartmentId: "" }));
    setErrors((current) => ({ ...current, floorId: undefined, apartmentId: undefined }));
    setSubmitError("");
  };

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const nextErrors = validateForm(form, { directory, editing, user });
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setSubmitError("Correct the highlighted fields and try again.");
      return;
    }

    setSaving(true);
    setSubmitError("");
    try {
      const payload = buildUserPayload(form, editing);
      if (editing) await superAdminService.updateUser(user.id, payload);
      else if (form.role === ROLES.MAINTENANCE_WORKER) await createMaintenanceWorker(payload, form.specialization);
      else await superAdminService.createUser(payload);
      showToast({ type: "success", message: editing ? "User updated." : "User created." });
      await onSaved();
      onClose();
    } catch (requestError) {
      setSubmitError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const needsCommunity = [ROLES.COMMUNITY_ADMIN, ROLES.TOWER_REPRESENTATIVE, ROLES.MAINTENANCE_WORKER, ROLES.RESIDENT].includes(form.role);
  const assignmentDescription = form.role === ROLES.SUPER_ADMIN
    ? "This account has platform-wide access and no hierarchy association."
    : form.role === ROLES.RESIDENT
      ? "Select the resident's exact community, tower, floor, and apartment."
      : form.role === ROLES.TOWER_REPRESENTATIVE
        ? "Select the community and tower this representative manages."
        : form.role === ROLES.MAINTENANCE_WORKER
          ? "Select the worker's community and maintenance specialization."
          : "Select the community this administrator manages.";

  return <Modal isOpen onClose={onClose} title={editing ? "Edit platform user" : "Create platform user"} size="lg" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="platform-user-form" loading={saving} disabled={saving}>{editing ? "Save changes" : "Create user"}</Button></>}>
    <form id="platform-user-form" className="sa-form sa-form--grid sa-user-form" onSubmit={submit} noValidate>
      {!editing && <><div className="sa-form__wide sa-user-form__intro"><p>Choose the role first. Required hierarchy and worker fields will update automatically.</p></div><div className="sa-form__wide"><Select label="Role" value={form.role} onChange={changeRole} error={errors.role} required><option value="">Select role</option>{roleValues.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}</Select></div></>}
      <div className="sa-form__wide sa-user-form__section"><strong>Account details</strong><span>Contact information and sign-in credentials.</span></div>
      <Input label="Full name" value={form.name} onChange={update("name")} maxLength="100" error={errors.name} required />
      <Input label="Email" type="email" value={form.email} onChange={update("email")} maxLength="100" error={errors.email} required />
      <Input label="Phone" type="tel" value={form.phone} onChange={update("phone")} maxLength="20" error={errors.phone} />
      <Input label={editing ? "New password" : "Password"} type="password" value={form.password} onChange={update("password")} minLength="8" maxLength="128" error={errors.password} required={!editing} hint={editing ? "Leave blank to keep the current password." : "Use at least 8 characters."} />

      {!editing && form.role && <div className="sa-form__wide sa-user-form__section"><strong>{form.role === ROLES.MAINTENANCE_WORKER ? "Worker profile" : "Role assignment"}</strong><span>{assignmentDescription}</span></div>}
      {!editing && needsCommunity && <Select label="Community" value={form.communityId} onChange={changeCommunity} error={errors.communityId} required><option value="">Select community</option>{directory.communities.map((community) => <option key={community.id} value={community.id}>{optionLabel(community)}</option>)}</Select>}
      {!editing && [ROLES.TOWER_REPRESENTATIVE, ROLES.RESIDENT].includes(form.role) && <Select label="Tower" value={form.towerId} onChange={changeTower} error={errors.towerId} disabled={!form.communityId} required><option value="">{form.communityId ? "Select tower" : "Select a community first"}</option>{towers.map((tower) => <option key={tower.id} value={tower.id}>{optionLabel(tower)}</option>)}</Select>}
      {!editing && form.role === ROLES.MAINTENANCE_WORKER && <Select label="Specialization" value={form.specialization} onChange={update("specialization")} error={errors.specialization} required><option value="">Select specialization</option>{workTypes.map((type) => <option key={type} value={type}>{formatEnum(type)}</option>)}</Select>}
      {!editing && form.role === ROLES.RESIDENT && <><Select label="Floor" value={form.floorId} onChange={changeFloor} error={errors.floorId} disabled={!form.towerId} required><option value="">{form.towerId ? "Select floor" : "Select a tower first"}</option>{floors.map((floor) => <option key={floor.id} value={floor.id}>{optionLabel(floor)}</option>)}</Select><Select label="Apartment" value={form.apartmentId} onChange={update("apartmentId")} error={errors.apartmentId} disabled={!form.floorId} required><option value="">{form.floorId ? "Select apartment" : "Select a floor first"}</option>{apartments.map((apartment) => <option key={apartment.id} value={apartment.id}>{optionLabel(apartment)}</option>)}</Select></>}
      {editing && <p className="sa-form__wide sa-muted">Role and hierarchy association remain unchanged because the current update contract does not safely clear prior associations.</p>}
      {submitError && <p className="sa-form__wide sa-user-form__error" role="alert">{submitError}</p>}
    </form>
  </Modal>;
}

function getCommunityId(user, directory) {
  if (user.communityId) return user.communityId;
  let towerId = user.towerId;
  if (!towerId && user.apartmentId) {
    const apartment = directory.apartments.find((item) => item.id === user.apartmentId);
    towerId = directory.floors.find((item) => item.id === apartment?.floorId)?.towerId;
  }
  return directory.towers.find((item) => item.id === towerId)?.communityId || "";
}

export function UsersPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [modal, setModal] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [communityFilter, setCommunityFilter] = useState("");

  const loadUsers = useCallback(async () => {
    const [users, communities, towers, floors, apartments, workers] = await Promise.all([superAdminService.listUsers(), superAdminService.listCommunities(), superAdminService.listTowers(), superAdminService.listFloors(), superAdminService.listApartments(), superAdminService.listWorkers()]);
    return { users, communities, towers, floors, apartments, workers };
  }, []);
  const loader = useAsyncResource(loadUsers);
  const rows = useMemo(() => loader.data ? loader.data.users.map((user) => ({ ...user, worker: loader.data.workers.find((worker) => worker.userId === user.id), resolvedCommunityId: getCommunityId(user, loader.data) })) : [], [loader.data]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (communityFilter && user.resolvedCommunityId !== communityFilter) return false;
      if (!query) return true;
      const communityName = loader.data?.communities.find((community) => community.id === user.resolvedCommunityId)?.name;
      return [user.name, user.email, user.phone, formatEnum(user.role), associationLabel(user, loader.data), communityName, user.worker ? formatEnum(user.worker.specialization) : "", user.worker ? formatEnum(user.worker.status) : ""].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [communityFilter, loader.data, roleFilter, rows, search]);

  async function removeUser() {
    setDeleting(true);
    try {
      await superAdminService.deleteUser(removing.id);
      showToast({ type: "success", message: "User deleted." });
      setRemoving(null);
      await loader.reload();
    } catch (error) {
      showToast({ type: "error", message: error.message });
    } finally {
      setDeleting(false);
    }
  }
  async function afterSave() {
    await loader.reload();
    if (modal?.id === currentUser?.id) await refreshUser();
  }

  const columns = [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "role", header: "Role", render: (value) => <StatusBadge status={value} label={formatEnum(value)} /> },
    { key: "scope", header: "Scope", render: (_, row) => associationLabel(row, loader.data) },
    { key: "worker", header: "Worker details", render: (worker, row) => worker ? <div className="sa-worker-summary"><strong>{formatEnum(worker.specialization)}</strong><div className="sa-worker-summary__meta"><StatusBadge status={worker.status} /><RatingStars value={worker.rating || 0} /></div></div> : <span className="sa-table-muted">{row.role === ROLES.MAINTENANCE_WORKER ? "Profile unavailable" : "Not applicable"}</span> },
    { key: "actions", header: "Actions", render: (_, row) => <div className="sa-actions"><Button size="sm" variant="secondary" onClick={() => setModal(row)}>Edit</Button><Button size="sm" variant="danger" disabled={row.id === currentUser?.id} onClick={() => setRemoving(row)}>Delete</Button></div> },
  ];

  if (loader.loading && !loader.data) return <LoadingState message="Loading platform users..." />;
  if (loader.error && !loader.data) return <ErrorState message={loader.error.message} onRetry={loader.reload} />;
  const hasFilters = Boolean(search || roleFilter || communityFilter);

  return <section>
    <PageHeader eyebrow="Access control" title="Platform users" description="Create and manage accounts across all Urbanity roles." actions={<Button onClick={() => setModal("create")}>Create user</Button>} />
    <div className="sa-user-filters" aria-label="Filter platform users"><div className="sa-user-filter-grid"><Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, scope, or specialization" /><Select label="Role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">All roles</option>{roleValues.map((role) => <option key={role} value={role}>{formatEnum(role)}</option>)}</Select><Select label="Community" value={communityFilter} onChange={(event) => setCommunityFilter(event.target.value)}><option value="">All communities</option>{loader.data.communities.map((community) => <option key={community.id} value={community.id}>{optionLabel(community)}</option>)}</Select></div></div>
    <Card flush><DataTable columns={columns} rows={filteredRows} rowKey="id" caption="Platform users" emptyTitle={hasFilters ? "No matching users" : "No platform users"} emptyMessage={hasFilters ? "Try adjusting or clearing the filters." : "Create the first platform account."} /></Card>
    {modal && <UserModal user={modal === "create" ? null : modal} directory={loader.data} onClose={() => setModal(null)} onSaved={afterSave} />}
    <ConfirmDialog isOpen={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={removeUser} loading={deleting} title="Delete user" message={`Delete ${removing?.name || "this user"}? This cannot be undone.`} confirmLabel="Delete" />
  </section>;
}
