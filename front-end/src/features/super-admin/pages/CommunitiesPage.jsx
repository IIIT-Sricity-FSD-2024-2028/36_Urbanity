import { useCallback, useMemo, useState } from "react";
import { Badge, Button, Card, ConfirmDialog, ErrorState, Input, LoadingState, Modal, Textarea, useToast } from "../../../components/ui/index.js";
import { DataTable, PageHeader } from "../../../components/data-display/index.js";
import { useAsyncResource } from "../hooks/useAsyncResource.js";
import { superAdminService } from "../services/superAdminService.js";

const blankCommunity = { name: "", address: "", description: "", adminName: "", adminEmail: "", adminPassword: "", contractedTowers: "1", contractedApartments: "1" };

function CommunityModal({ community, open, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => community ? { name: community.name || "", address: community.address || "", description: community.description || "" } : blankCommunity);
  const [saving, setSaving] = useState(false);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      if (community) await superAdminService.updateCommunity(community.id, { name: form.name.trim(), address: form.address.trim(), description: form.description.trim() });
      else await superAdminService.createCommunity({ ...form, name: form.name.trim(), address: form.address.trim(), description: form.description.trim(), adminName: form.adminName.trim(), adminEmail: form.adminEmail.trim().toLowerCase(), contractedTowers: Number(form.contractedTowers), contractedApartments: Number(form.contractedApartments) });
      showToast({ type: "success", message: community ? "Community updated." : "Community and administrator created." });
      await onSaved(); onClose();
    } catch (error) { showToast({ type: "error", message: error.message }); }
    finally { setSaving(false); }
  };
  return <Modal isOpen={open} onClose={onClose} title={community ? "Edit community" : "Create community"} size="lg" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="community-form" loading={saving}>Save</Button></>}>
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
  const loader = useCallback(async () => { const [communities, subscriptions, users] = await Promise.all([superAdminService.listCommunities(), superAdminService.listSubscriptions(), superAdminService.listUsers()]); return { communities, subscriptions, users }; }, []);
  const { data, loading, error, reload } = useAsyncResource(loader);
  const [editing, setEditing] = useState(null); const [creating, setCreating] = useState(false); const [removing, setRemoving] = useState(null); const [deleting, setDeleting] = useState(false);
  const rows = useMemo(() => (data?.communities || []).map((community) => ({ ...community, subscription: data.subscriptions.find((item) => item.communityId === community.id), admin: data.users.find((item) => item.communityId === community.id && item.role === "COMMUNITY_ADMIN") })), [data]);
  const columns = [
    { key: "name", header: "Community" }, { key: "address", header: "Address" },
    { key: "admin", header: "Administrator", render: (value) => value?.name || "Not assigned" },
    { key: "subscription", header: "Subscription", render: (value) => <Badge variant={value?.status === "ACTIVE" ? "success" : "warning"}>{value?.status || "Unavailable"}</Badge> },
    { key: "capacity", header: "Contract", render: (_, row) => row.subscription ? `${row.subscription.contractedTowers} towers / ${row.subscription.contractedApartments} apartments` : "Unavailable" },
    { key: "actions", header: "Actions", render: (_, row) => <div className="sa-actions"><Button variant="secondary" onClick={() => setEditing(row)}>Edit</Button><Button variant="danger" onClick={() => setRemoving(row)}>Delete</Button></div> },
  ];
  const remove = async () => { setDeleting(true); try { await superAdminService.deleteCommunity(removing.id); showToast({ type: "success", message: "Community deleted." }); setRemoving(null); await reload(); } catch (requestError) { showToast({ type: "error", message: requestError.message }); } finally { setDeleting(false); } };
  return <>
    <PageHeader eyebrow="Hierarchy" title="Communities" description="Create and maintain top-level Urbanity communities." actions={<Button onClick={() => setCreating(true)}>Create community</Button>} />
    {loading && <LoadingState message="Loading communities..." />}{error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <Card flush><DataTable rows={rows} columns={columns} caption="Communities" emptyTitle="No communities" emptyMessage="Create the first community to begin." /></Card>}
    {creating && <CommunityModal open onClose={() => setCreating(false)} onSaved={reload} />}
    {editing && <CommunityModal key={editing.id} community={editing} open onClose={() => setEditing(null)} onSaved={reload} />}
    <ConfirmDialog isOpen={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={remove} loading={deleting} title="Delete community" message="This succeeds only when the backend confirms that no child towers prevent deletion." confirmLabel="Delete" />
  </>;
}
