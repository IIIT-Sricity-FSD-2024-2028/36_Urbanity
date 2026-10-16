import { useCallback, useState } from "react";
import { Button, Modal, Textarea, useToast } from "../../../components/ui/index.js";

// Shared by "Cancel appointment" and "Mark as missed": both require a recorded reason.
export function AppointmentReasonModal({ title, intro, label, confirmLabel, loadingLabel, success, confirmVariant = "danger", onSubmit, onClose, onDone }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleClose = useCallback(() => { if (!submitting) onClose(); }, [onClose, submitting]);

  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
      showToast({ type: "success", message: success });
      setSubmitting(false);
      onClose();
      await onDone();
    } catch (requestError) {
      showToast({ type: "error", message: requestError.message || "Unable to update the appointment." });
      setSubmitting(false);
      onDone();
    }
  };

  return (
    <Modal
      isOpen
      onClose={handleClose}
      closeOnOverlay={!submitting}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>Back</Button>
          <Button type="submit" form="tr-appointment-reason" variant={confirmVariant} loading={submitting} loadingLabel={loadingLabel} disabled={!reason.trim()}>{confirmLabel}</Button>
        </>
      }
    >
      <form id="tr-appointment-reason" className="tr-form" onSubmit={submit}>
        {intro && <p className="tr-muted">{intro}</p>}
        <Textarea label={label} required value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} disabled={submitting} />
      </form>
    </Modal>
  );
}
