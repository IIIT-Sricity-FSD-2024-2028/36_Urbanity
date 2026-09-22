import { useEffect, useState } from "react";
import { Button, EmptyState, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { maintenanceWorkerService as service } from "../services/maintenanceWorkerService.js";
import { formatDate, IMAGE_TYPES } from "../utils/workflow.js";

function Attachment({ taskId, attachment }) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState({ url: null, error: null, loading: false });
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let objectUrl;
    setPreview({ url: null, error: null, loading: true });
    service.getAttachmentBlob(taskId, attachment.id, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      if (!(blob instanceof Blob) || !IMAGE_TYPES.includes(blob.type)) {
        throw new Error("This attachment is not a supported image.");
      }
      objectUrl = URL.createObjectURL(blob);
      setPreview({ url: objectUrl, error: null, loading: false });
    }).catch((error) => {
      if (!controller.signal.aborted) setPreview({ url: null, error, loading: false });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [taskId, attachment.id, open, attempt]);

  return <li className="mw-attachment">
    <div className="mw-attachment-heading">
      <div><strong>{attachment.originalName || "Image attachment"}</strong>
        <small className="mw-secondary">{attachment.purpose === "RESOLUTION_PROOF" ? "Resolution proof" : "Complaint image"} · {formatDate(attachment.uploadedAt)}</small>
      </div>
      <Button variant="secondary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Hide image" : "View image"}</Button>
    </div>
    {open && <>
      {preview.loading && <LoadingState message="Loading protected image..." />}
      {preview.error && <ErrorState message={preview.error.message} onRetry={() => setAttempt((value) => value + 1)} />}
      {preview.url && <>
        <img className="mw-preview" src={preview.url} alt={attachment.originalName || "Complaint attachment"} />
        <a href={preview.url} download={attachment.originalName || "attachment"}>Download image</a>
      </>}
    </>}
  </li>;
}

export function AttachmentGallery({ taskId, attachments }) {
  if (!attachments.length) return <EmptyState title="No attachments" message="Images uploaded for this complaint will appear here." />;
  return <ul className="mw-attachments">{attachments.map((attachment) => <Attachment key={attachment.id} taskId={taskId} attachment={attachment} />)}</ul>;
}
