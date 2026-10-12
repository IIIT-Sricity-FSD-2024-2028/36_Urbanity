import { useCallback, useState } from "react";
import { Button, Modal, useToast } from "../../../components/ui/index.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";

const RATINGS = [1, 2, 3, 4, 5];

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
        <fieldset className="tr-rating" disabled={submitting} aria-describedby={error ? "tr-rating-error" : undefined}>
          <legend>Work-quality rating <span className="ui-field__required">*</span></legend>
          <div className="tr-rating__options">
            {RATINGS.map((value) => (
              <label key={value} className={`tr-rating__option${rating >= value ? " tr-rating__option--selected" : ""}`}>
                <input
                  type="radio"
                  name="authorityRating"
                  value={value}
                  checked={rating === value}
                  onChange={() => { setRating(value); setError(""); }}
                />
                <span aria-hidden="true">★</span>
                <span className="sr-only">{value} out of 5</span>
              </label>
            ))}
          </div>
          <p className="tr-muted">{rating ? `${rating} out of 5 selected` : "No rating selected"}</p>
          {error && <p className="ui-field__error" id="tr-rating-error">{error}</p>}
        </fieldset>
      </form>
    </Modal>
  );
}
