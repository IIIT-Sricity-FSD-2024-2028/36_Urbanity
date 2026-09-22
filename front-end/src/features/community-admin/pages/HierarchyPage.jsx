import { useCallback, useMemo, useState } from "react";
import { Button, Card, ConfirmDialog, ErrorState, Input, LoadingState, Modal, Select, Textarea, useToast } from "../../../components/ui/index.js";
import { DataTable, PageHeader } from "../../../components/data-display/index.js";
import { useCommunityResource } from "../hooks/useCommunityResource.js";
import { communityAdminService } from "../services/communityAdminService.js";
import { entityName } from "../utils.js";

const definitions = {
  tower: { title: "tower", fields: ["name", "code", "description"] },
  floor: { title: "floor", fields: ["towerId", "floorNumber", "label"] },
  apartment: { title: "apartment", fields: ["floorId", "apartmentNumber", "label"] },
};

function HierarchyModal({ kind, item, data, onClose, onSaved }) {
  const { showToast } = useToast();
  const definition = definitions[kind];
  const [form, setForm] = useState(() => definition.fields.reduce((values, field) => ({ ...values, [field]: item?.[field] ?? "" }), {}));
  const [saving, setSaving] = useState(false);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      let payload;
      if (kind === "tower") payload = { communityId: data.community.id, name: form.name.trim(), code: form.code.trim(), description: form.description.trim() };
      if (kind === "floor") payload = { towerId: form.towerId, floorNumber: Number(form.floorNumber), label: form.label.trim() };
      if (kind === "apartment") payload = { floorId: form.floorId, apartmentNumber: form.apartmentNumber.trim(), label: form.label.trim() };
      const action = item ? `update${definition.title[0].toUpperCase()}${definition.title.slice(1)}` : `create${definition.title[0].toUpperCase()}${definition.title.slice(1)}`;
      await communityAdminService[action](...(item ? [item.id, payload] : [payload]));
      showToast({ type: "success", message: `${definition.title[0].toUpperCase()}${definition.title.slice(1)} ${item ? "updated" : "created"}.` });
      await onSaved(); onClose();
    } catch (error) { showToast({ type: "error", message: error.message }); }
    finally { setSaving(false); }
  };
  return <Modal isOpen onClose={onClose} title={`${item ? "Edit" : "Create"} ${definition.title}`} footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="hierarchy-form" loading={saving}>Save</Button></>}>
    <form id="hierarchy-form" className="ca-form" onSubmit={submit}>
      {kind === "tower" && <><Input label="Tower name" value={form.name} onChange={update("name")} required /><Input label="Tower code" value={form.code} onChange={update("code")} required /><Textarea label="Description" value={form.description} onChange={update("description")} rows="3" /></>}
      {kind === "floor" && <><Select label="Tower" value={form.towerId} onChange={update("towerId")} required><option value="">Select tower</option>{data.towers.map((tower) => <option key={tower.id} value={tower.id}>{tower.name} ({tower.code})</option>)}</Select><Input label="Floor number" type="number" min="0" value={form.floorNumber} onChange={update("floorNumber")} required /><Input label="Label" value={form.label} onChange={update("label")} required /></>}
      {kind === "apartment" && <><Select label="Floor" value={form.floorId} onChange={update("floorId")} required><option value="">Select floor</option>{data.floors.map((floor) => <option key={floor.id} value={floor.id}>{entityName(data.towers, floor.towerId)} — {floor.label}</option>)}</Select><Input label="Apartment number" value={form.apartmentNumber} onChange={update("apartmentNumber")} required /><Input label="Label" value={form.label} onChange={update("label")} required /></>}
    </form>
  </Modal>;
}

export function HierarchyPage() {
  const { showToast } = useToast();
  const loader = useCallback(async () => { const [communities, towers, floors, apartments] = await Promise.all([communityAdminService.listCommunities(), communityAdminService.listTowers(), communityAdminService.listFloors(), communityAdminService.listApartments()]); return { community: communities[0], towers, floors, apartments }; }, []);
  const { data, loading, error, reload } = useCommunityResource(loader);
  const [dialog, setDialog] = useState(null); const [removing, setRemoving] = useState(null); const [deleting, setDeleting] = useState(false);
  const towerColumns = useMemo(() => [{ key: "name", header: "Tower" }, { key: "code", header: "Code" }, { key: "description", header: "Description", render: (value) => value || "—" }, { key: "actions", header: "Actions", render: (_, row) => <div className="ca-actions"><Button variant="secondary" onClick={() => setDialog({ kind: "tower", item: row })}>Edit</Button><Button variant="danger" onClick={() => setRemoving({ kind: "tower", item: row })}>Delete</Button></div> }], []);
  const floorColumns = useMemo(() => [{ key: "label", header: "Floor" }, { key: "floorNumber", header: "Number" }, { key: "towerId", header: "Tower", render: (value) => entityName(data?.towers, value) }, { key: "actions", header: "Actions", render: (_, row) => <div className="ca-actions"><Button variant="secondary" onClick={() => setDialog({ kind: "floor", item: row })}>Edit</Button><Button variant="danger" onClick={() => setRemoving({ kind: "floor", item: row })}>Delete</Button></div> }], [data]);
  const apartmentColumns = useMemo(() => [{ key: "apartmentNumber", header: "Apartment" }, { key: "label", header: "Label" }, { key: "floorId", header: "Floor", render: (value) => entityName(data?.floors, value) }, { key: "actions", header: "Actions", render: (_, row) => <div className="ca-actions"><Button variant="secondary" onClick={() => setDialog({ kind: "apartment", item: row })}>Edit</Button><Button variant="danger" onClick={() => setRemoving({ kind: "apartment", item: row })}>Delete</Button></div> }], [data]);
  const remove = async () => { setDeleting(true); try { const name = removing.kind[0].toUpperCase() + removing.kind.slice(1); await communityAdminService[`delete${name}`](removing.item.id); showToast({ type: "success", message: `${name} deleted.` }); setRemoving(null); await reload(); } catch (error) { showToast({ type: "error", message: error.message }); } finally { setDeleting(false); } };
  return <>
    <PageHeader eyebrow="Community structure" title="Hierarchy" description="Manage the towers, floors, and apartments in your backend-scoped community." />
    {loading && <LoadingState message="Loading community hierarchy..." />}{error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <div className="ca-stack">
      <Card title={data.community?.name || "Community information"}><dl className="ca-details"><div><dt>Address</dt><dd>{data.community?.address || "Unavailable"}</dd></div><div><dt>Description</dt><dd>{data.community?.description || "No description"}</dd></div></dl></Card>
      <Card title="Towers" actions={<Button onClick={() => setDialog({ kind: "tower" })}>Add tower</Button>} flush><DataTable rows={data.towers} columns={towerColumns} emptyTitle="No towers" emptyMessage="Add a tower to begin the community hierarchy." /></Card>
      <Card title="Floors" actions={<Button onClick={() => setDialog({ kind: "floor" })} disabled={!data.towers.length}>Add floor</Button>} flush><DataTable rows={data.floors} columns={floorColumns} emptyTitle="No floors" /></Card>
      <Card title="Apartments" actions={<Button onClick={() => setDialog({ kind: "apartment" })} disabled={!data.floors.length}>Add apartment</Button>} flush><DataTable rows={data.apartments} columns={apartmentColumns} emptyTitle="No apartments" /></Card>
    </div>}
    {dialog && <HierarchyModal key={`${dialog.kind}-${dialog.item?.id || "new"}`} {...dialog} data={data} onClose={() => setDialog(null)} onSaved={reload} />}
    <ConfirmDialog isOpen={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={remove} loading={deleting} title={`Delete ${removing?.kind || "item"}`} message="Deletion succeeds only when the backend confirms that no dependent resources exist." confirmLabel="Delete" />
  </>;
}
