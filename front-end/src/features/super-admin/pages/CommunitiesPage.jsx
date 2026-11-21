import { useCallback, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, ConfirmDialog, ErrorState, Input, LoadingState, Modal, Textarea, useToast } from "../../../components/ui/index.js";
import { getSessionRevision } from "../../../api/client.js";
import { useAppDispatch } from "../../../app/reduxHooks.js";
import { DataTable, PageHeader } from "../../../components/data-display/index.js";
import { useAsyncResource } from "../hooks/useAsyncResource.js";
import {
  createSuperAdminCommunity,
  useDeleteSuperAdminCommunityMutation,
  useSuperAdminCommunityDirectory,
  useUpdateSuperAdminCommunityMutation,
} from "../services/superAdminCommunitiesApi.js";
import { superAdminService } from "../services/superAdminService.js";

const blankCommunity = { name: "", address: "", description: "", adminName: "", adminEmail: "", adminPassword: "", contractedTowers: "1", contractedApartments: "1" };

function CommunityModal({ community, open, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => community ? { name: community.name || "", address: community.address || "", description: community.description || "" } : blankCommunity);
  const dispatch = useAppDispatch();
  const [updateCommunity] = useUpdateSuperAdminCommunityMutation();
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const close = () => { if (!submitting.current) onClose(); };
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    const revision = getSessionRevision();
    const changes = {
      name: form.name.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
    };
    try {
      if (community) {
        await updateCommunity({ id: community.id, changes }).unwrap();
      } else {
        await createSuperAdminCommunity({
          ...changes,
          adminName: form.adminName.trim(),
          adminEmail: form.adminEmail.trim().toLowerCase(),
          adminPassword: form.adminPassword,
          contractedTowers: Number(form.contractedTowers),
          contractedApartments: Number(form.contractedApartments),
        }, dispatch);
      }
      if (revision !== getSessionRevision()) return;
      showToast({ type: "success", message: community ? "Community updated." : "Community and administrator created." });
      if (!community) await onSaved();
      onClose();
    } catch (error) {
      if (revision === getSessionRevision()) showToast({ type: "error", message: error.message });
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };
  return <Modal isOpen={open} onClose={close} closeOnOverlay={!saving} title={community ? "Edit community" : "Create community"} size="lg" footer={<><Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button><Button type="submit" form="community-form" loading={saving}>Save</Button></>}>
    <form id="community-form" className="sa-form sa-form--grid" onSubmit={submit}>
      <Input label="Community name" value={form.name} onChange={update("name")} required />
      <Input label="Address" value={form.address} onChange={update("address")} required />
      <div className="sa-form__wide"><Textarea label="Description" value={form.description} onChange={update("description")} rows="3" /></div>
      {!community && <>
        <Input label="Administrator name" value={form.adminName} onChange={update("adminName")} required />
        <Input label="Administrator email" type="email" value={form.adminEmail} onChange={update("adminEmail")} required />
        <Input label="Temporary password" type="password" value={form.adminPassword} onChange={update("adminPassword")} required />
        <Input label="Contracted towers" type="number" min="1" value={form.contractedTowers} onChange={update("contractedTowers")} required />
        <Input label="Contracted apartments" type="number" min="1" value={form.contractedApartments} onChange={update("contractedApartments")} required />
      </>}
    </form>
  </Modal>;
}

export function CommunitiesPage() {
  const { showToast } = useToast();
  const directory = useSuperAdminCommunityDirectory();
  const communities = directory.currentData;
  const loader = useCallback(async () => {
    const [subscriptions, users] = await Promise.all([superAdminService.listSubscriptions(), superAdminService.listUsers()]);
    return { subscriptions, users };
  }, []);
  const related = useAsyncResource(loader);
  const error = directory.error || related.error;
  const loading = directory.isFetching || related.loading;
  const retry = () => {
    if (directory.isError) directory.refetch();
    if (related.error) related.reload();
  };
  const [deleteCommunity] = useDeleteSuperAdminCommunityMutation();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const deletePending = useRef(false);
  const rows = useMemo(() => {
    if (!communities || !related.data) return [];
    return communities.map((community) => ({
      ...community,
      subscription: related.data.subscriptions.find((item) => item.communityId === community.id),
      admin: related.data.users.find((item) => item.communityId === community.id && item.role === "COMMUNITY_ADMIN"),
    }));
  }, [communities, related.data]);
  const columns = [
    { key: "name", header: "Community" }, { key: "address", header: "Address" },
    { key: "admin", header: "Administrator", render: (value) => value?.name || "Not assigned" },
    { key: "subscription", header: "Subscription", render: (value) => <Badge variant={value?.status === "ACTIVE" ? "success" : "warning"}>{value?.status || "Unavailable"}</Badge> },
    { key: "capacity", header: "Contract", render: (_, row) => row.subscription ? `${row.subscription.contractedTowers} towers / ${row.subscription.contractedApartments} apartments` : "Unavailable" },
    { key: "actions", header: "Actions", render: (_, row) => <div className="sa-actions"><Button variant="secondary" onClick={() => setEditing(row)}>Edit</Button><Button variant="danger" onClick={() => setRemoving(row)}>Delete</Button></div> },
  ];
  const remove = async () => {
    if (!removing || deletePending.current) return;
    deletePending.current = true;
    setDeleting(true);
    const revision = getSessionRevision();
    try {
      await deleteCommunity(removing.id).unwrap();
      if (revision !== getSessionRevision()) return;
      showToast({ type: "success", message: "Community deleted." });
      setRemoving(null);
    } catch (error) {
      if (revision === getSessionRevision()) showToast({ type: "error", message: error.message });
    } finally {
      deletePending.current = false;
      setDeleting(false);
    }
  };
  return <>
    <PageHeader eyebrow="Hierarchy" title="Communities" description="Create and maintain top-level Urbanity communities." actions={<Button onClick={() => setCreating(true)}>Create community</Button>} />
    {loading && <LoadingState message="Loading communities..." />}{error && <ErrorState message={error.message} onRetry={retry} />}
    {communities && related.data && !error && <Card flush><DataTable rows={rows} columns={columns} caption="Communities" emptyTitle="No communities" emptyMessage="Create the first community to begin." /></Card>}
    {creating && <CommunityModal open onClose={() => setCreating(false)} onSaved={related.reload} />}
    {editing && <CommunityModal key={editing.id} community={editing} open onClose={() => setEditing(null)} />}
    <ConfirmDialog isOpen={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={remove} loading={deleting} title="Delete community" message="This succeeds only when the backend confirms that no child towers prevent deletion." confirmLabel="Delete" />
  </>;
}
