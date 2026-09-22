import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, ErrorState, LoadingState, Modal, useToast } from "../../../components/ui/index.js";
import { DataTable, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { useAsyncResource } from "../hooks/useAsyncResource.js";
import { superAdminService } from "../services/superAdminService.js";
import { entityName, formatDate, formatEnum } from "../utils/formatters.js";

function ComplaintDetails({ complaintId, communities, onClose }) {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, complaint: null, attachments: [], review: null, error: null });
  const [preview, setPreview] = useState(null); const [previewing, setPreviewing] = useState(null);
  useEffect(() => {
    let active = true;
    (async () => { try {
      const complaint = await superAdminService.getComplaint(complaintId);
      const [attachments, review] = await Promise.allSettled([superAdminService.getComplaintAttachments(complaintId), superAdminService.getComplaintReview(complaintId)]);
      if (active) setState({ loading: false, complaint, attachments: attachments.status === "fulfilled" ? attachments.value : [], review: review.status === "fulfilled" ? review.value : null, error: null });
    } catch (error) { if (active) setState((current) => ({ ...current, loading: false, error })); } })();
    return () => { active = false; };
  }, [complaintId]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  const showAttachment = async (attachment) => { setPreviewing(attachment.id); try { const blob = await superAdminService.downloadComplaintAttachment(complaintId, attachment.id); if (preview?.url) URL.revokeObjectURL(preview.url); setPreview({ url: URL.createObjectURL(blob), attachment }); } catch (error) { showToast({ type: "error", message: error.message }); } finally { setPreviewing(null); } };
  const item = state.complaint;
  return <Modal isOpen onClose={onClose} title="Complaint details" size="lg" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
    {state.loading && <LoadingState message="Loading complaint details..." />}{state.error && <ErrorState message={state.error.message} />}
    {item && <div className="sa-detail-stack">
      <div><h3>{item.title}</h3><p>{item.description}</p></div>
      <dl className="sa-details"><div><dt>Status</dt><dd><StatusBadge status={item.status} /></dd></div><div><dt>Community</dt><dd>{entityName(communities, item.communityId)}</dd></div><div><dt>Type</dt><dd>{formatEnum(item.type)}</dd></div><div><dt>Work type</dt><dd>{formatEnum(item.requiredWorkType)}</dd></div><div><dt>Responsible authority</dt><dd>{item.responsibleUserName || "Not assigned"}</dd></div><div><dt>Created</dt><dd>{formatDate(item.createdAt)}</dd></div></dl>
      <section><h3>Status history</h3>{item.statusHistory?.length ? <ol className="sa-timeline">{item.statusHistory.map((entry, index) => <li key={`${entry.status}-${index}`}><StatusBadge status={entry.status} /> <span>{formatDate(entry.changedAt)}</span></li>)}</ol> : <p className="sa-muted">No history available.</p>}</section>
      <section><h3>Attachments</h3>{state.attachments.length ? <div className="sa-attachments">{state.attachments.map((attachment) => <div key={attachment.id}><span>{attachment.originalName} · {attachment.mimeType} · {attachment.size} bytes</span><Button variant="secondary" loading={previewing === attachment.id} onClick={() => showAttachment(attachment)}>Preview</Button></div>)}</div> : <p className="sa-muted">No attachments.</p>}
        {preview && (preview.attachment.mimeType?.startsWith("image/") ? <img className="sa-attachment-preview" src={preview.url} alt={preview.attachment.originalName} /> : <a className="sa-download" href={preview.url} download={preview.attachment.originalName}>Download {preview.attachment.originalName}</a>)}</section>
      <section><h3>Resident review</h3>{state.review ? <p>{state.review.rating} / 5{state.review.feedback ? ` · ${state.review.feedback}` : ""} <span className="sa-muted">({formatDate(state.review.createdAt)})</span></p> : <p className="sa-muted">Awaiting resident review.</p>}</section>
    </div>}
  </Modal>;
}

export function ComplaintsPage() {
  const loader = useCallback(async () => { const [complaints, communities] = await Promise.all([superAdminService.listComplaints(), superAdminService.listCommunities()]); return { complaints, communities }; }, []);
  const { data, loading, error, reload } = useAsyncResource(loader); const [selected, setSelected] = useState(null);
  const columns = useMemo(() => [
    { key: "title", header: "Complaint" }, { key: "communityId", header: "Community", render: (value) => entityName(data.communities, value) },
    { key: "type", header: "Type", render: formatEnum }, { key: "status", header: "Status", render: (value) => <StatusBadge status={value} /> },
    { key: "requiredWorkType", header: "Work type", render: formatEnum }, { key: "responsibleUserName", header: "Responsible authority", render: (value) => value || "Not assigned" },
    { key: "createdAt", header: "Created", render: formatDate }, { key: "action", header: "", render: (_, row) => <Button variant="secondary" onClick={() => setSelected(row.id)}>View details</Button> },
  ], [data]);
  return <>
    <PageHeader eyebrow="Oversight" title="Complaints" description="Global read-only visibility into complaints and their backend-authorized lifecycle." />
    {loading && <LoadingState message="Loading complaints..." />}{error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <Card flush><DataTable rows={data.complaints} columns={columns} caption="All complaints" emptyTitle="No complaints" emptyMessage="No complaints have been submitted." /></Card>}
    {selected && <ComplaintDetails complaintId={selected} communities={data.communities} onClose={() => setSelected(null)} />}
  </>;
}
