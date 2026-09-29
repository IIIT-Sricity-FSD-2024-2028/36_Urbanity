import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal, useToast } from "../../../components/ui/index.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { formatBytes, formatDateTime, formatEnum } from "../utils/formatters.js";

// Attachments are retrieved through the authenticated API client and shown via
// object URLs, which are revoked when replaced, closed, or unmounted.
export function AttachmentList({ complaintId, attachments, emptyMessage = "No attachments." }) {
  const { showToast } = useToast();
  const [loadingId, setLoadingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const openAttachment = async (attachment) => {
    setLoadingId(attachment.id);
    try {
      const blob = await towerRepresentativeService.downloadComplaintAttachment(complaintId, attachment.id);
      const url = URL.createObjectURL(blob);
      if (!mountedRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setPreview({ url, attachment });
    } catch (error) {
      if (mountedRef.current) showToast({ type: "error", message: error.message || "Unable to open this attachment." });
    } finally {
      if (mountedRef.current) setLoadingId(null);
    }
  };

  const closePreview = useCallback(() => setPreview(null), []);

  if (!attachments.length) return <p className="tr-muted">{emptyMessage}</p>;

  const isImage = preview?.attachment.mimeType?.startsWith("image/");

  return (
    <>
      <ul className="tr-attachments">
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <div className="tr-cell-stack">
              <strong>{attachment.originalName || "Attachment"}</strong>
              <span className="tr-muted">
                {formatBytes(attachment.size)} · Uploaded by {formatEnum(attachment.uploadedByRole)} · {formatDateTime(attachment.uploadedAt)}
              </span>
            </div>
            <Button
              variant="secondary"
              loading={loadingId === attachment.id}
              loadingLabel="Opening..."
              disabled={Boolean(loadingId) && loadingId !== attachment.id}
              onClick={() => openAttachment(attachment)}
            >
              View
            </Button>
          </li>
        ))}
      </ul>

      <Modal
        isOpen={Boolean(preview)}
        onClose={closePreview}
        title={preview?.attachment.originalName || "Attachment"}
        size="lg"
        footer={<Button variant="secondary" onClick={closePreview}>Close</Button>}
      >
        {preview && (isImage ? (
          <img className="tr-attachment-preview" src={preview.url} alt={preview.attachment.originalName || "Complaint attachment"} />
        ) : (
          <a className="tr-download" href={preview.url} download={preview.attachment.originalName}>
            Download {preview.attachment.originalName}
          </a>
        ))}
      </Modal>
    </>
  );
}
