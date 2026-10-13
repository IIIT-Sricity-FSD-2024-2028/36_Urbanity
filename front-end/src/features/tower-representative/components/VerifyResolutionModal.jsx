import { useCallback, useState } from "react";
import { Button, Modal, StarRatingInput, useToast } from "../../../components/ui/index.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";

export function VerifyResolutionModal({ complaint, onClose, onVerified }) {
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleClose = useCallback(() => {
    if (!submitting) onClose();
  }, [onClose, submitting]);

  const submit = async (event) => {
    event.preventDefault();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError("Select a work-quality rating from 1 to 5.");
      return;
    }
    setSubmitting(true);
    try {
      await towerRepresentativeService.verifyResolution(complaint.id, rating);
      showToast({ type: "success", message: "Resolution verified. The resident can now submit a review." });
      setSubmitting(false);
      onClose();
      await onVerified();
    } catch (requestError) {
      showToast({ type: "error", message: requestError.message || "Unable to verify the resolution." });
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={handleClose}
      closeOnOverlay={!submitting}
      title="Verify resolution"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="tr-verify-form" loading={submitting} loadingLabel="Verifying...">Verify resolution</Button>
        </>
      }
    >
      <form id="tr-verify-form" className="tr-form" onSubmit={submit}>
        <p className="tr-muted tr-modal-intro">
          Confirm that the submitted proof resolves “{complaint.title}”. Verification moves the complaint to Resolved and records your rating of the work.
        </p>
        <StarRatingInput label="Work-quality rating" name="authorityRating" value={rating} onChange={(value) => { setRating(value); setError(""); }} disabled={submitting} error={error} required />
      </form>
    </Modal>
  );
}
