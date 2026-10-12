import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, EmptyState, ErrorState, LoadingState, useToast } from "../../../components/ui/index.js";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";
import { dateTime, IMAGE_TYPES, validateImages } from "../utils.js";
import { AttachmentPicker } from "./AttachmentPicker.jsx";

function ProtectedImage({ complaintId, attachment }) {
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState({ url: null, error: null });
  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    let objectUrl;
    setPreview({ url: null, error: null });
    residentService.getAttachment(complaintId, attachment.id).then((blob) => {
      if (!active) return;
      if (!IMAGE_TYPES.includes(blob.type)) throw new Error("The attachment is not a supported image.");
      objectUrl = URL.createObjectURL(blob);
      setPreview({ url: objectUrl, error: null });
    }).catch((error) => { if (active) setPreview({ url: null, error }); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible, attempt, complaintId, attachment.id]);

  return <div className="resident-attachment resident-stack">
    <div><strong>{attachment.originalName}</strong><p className="resident-muted">{attachment.purpose === "RESOLUTION_PROOF" ? "Resolution proof" : "Supporting image"} · {dateTime(attachment.uploadedAt)}</p></div>
    <Button variant="secondary" onClick={() => { setPreview({ url: null, error: null }); setVisible((current) => !current); }}>{visible ? "Hide image" : "View image"}</Button>
    {visible && (preview.error ? <ErrorState title="Image unavailable" message={preview.error.message} onRetry={() => setAttempt((value) => value + 1)} /> : preview.url ? <>
      <img src={preview.url} alt={attachment.originalName} />
      <a href={preview.url} download={attachment.originalName}>Download {attachment.originalName}</a>
    </> : <LoadingState message="Loading protected image..." />)}
  </div>;
}

export function ComplaintAttachments({ complaintId, onUploaded }) {
  const loader = useCallback(() => residentService.listAttachments(complaintId), [complaintId]);
  const { data, loading, error, reload } = useResidentResource(loader);
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [failures, setFailures] = useState([]);
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const lock = useRef(false);
  const { showToast } = useToast();

  async function upload(event) {
    event.preventDefault();
    if (lock.current || !files.length) return;
    const message = validateImages(files);
    setFileError(message);
    if (message) return;
    lock.current = true;
    setUploading(true);
    try {
      const results = await Promise.allSettled(files.map((file) => residentService.uploadAttachment(complaintId, file)));
      const failedFiles = files.filter((_, index) => results[index].status === "rejected");
      const messages = results.flatMap((result, index) => result.status === "rejected" ? [`${files[index].name}: ${result.reason.message}`] : []);
      setFailures(messages);
      setFiles(failedFiles);
      setInputKey((value) => value + 1);
      const succeeded = files.length - failedFiles.length;
      if (succeeded) {
        showToast({ type: "success", message: `${succeeded} image${succeeded === 1 ? "" : "s"} uploaded.` });
        await reload();
        onUploaded();
      }
      if (messages.length) showToast({ type: "error", message: "Some images could not be uploaded. Retry the remaining files below." });
    } finally {
      lock.current = false;
      setUploading(false);
    }
  }

  return <Card title="Complaint images"><div className="resident-stack">
    {loading && <LoadingState message="Loading attachments..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && (data.length ? <div className="resident-grid">{data.map((attachment) => <ProtectedImage key={attachment.id} complaintId={complaintId} attachment={attachment} />)}</div> : <EmptyState title="No images attached" message="You can add supporting images below." />)}
    <form className="resident-stack" onSubmit={upload}>
      {failures.length > 0 && <ErrorState title="Some images were not uploaded" message={failures.join(" ")} />}
      <AttachmentPicker inputKey={inputKey} files={files} onChange={setFiles} error={fileError} onError={setFileError} disabled={uploading} />
      <div><Button type="submit" loading={uploading} loadingLabel="Uploading images..." disabled={!files.length}>Upload selected images</Button></div>
    </form>
  </div></Card>;
}
