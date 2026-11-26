import { useId, useRef, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, ConfirmDialog, Modal, Textarea, useToast } from "../../../components/ui/index.js";
import { formatEstimateAmount, decisionActions } from "../estimateModel.js";
import { useChangeComplaintEstimateMutation } from "../services/complaintEstimatesApi.js";

export function EstimateActions({ record, role, refreshing, onAssignmentReleased }) {
  const { sessionRevision } = useAuth();
  const { showToast } = useToast();
  const formId = useId();
  const inFlight = useRef(false);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [change, { isLoading }] = useChangeComplaintEstimateMutation();
  const options = decisionActions(record, role);
  const { complaint, estimate } = record;
  if (!options.length) return null;

  function close() {
    if (inFlight.current) return;
    setAction(null);
    setReason("");
    setError("");
  }

  async function confirm(event) {
    event?.preventDefault();
    if (inFlight.current || !action) return;
    if (action.reason && !reason.trim()) {
      setError("Enter a reason or revision feedback.");
      return;
    }
    inFlight.current = true;
    setError("");
    try {
      const result = await change({
        id: complaint.id, estimateId: estimate.id, sessionRevision, role, operation: action.operation,
        payload: { decision: action.decision, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      }).unwrap();
      showToast({
        type: "success",
        message: action.operation === "pay" ? `Mock payment completed. Reference ${result.reference}.` : action.success,
      });
      inFlight.current = false;
      close();
      if (action.operation === "cancel") onAssignmentReleased?.();
    } catch (requestError) {
      setError(requestError.message);
      showToast({ type: "error", message: requestError.message });
    } finally {
      inFlight.current = false;
    }
  }

  const summary = estimate && `“${complaint.title}” · ${complaint.workerName} · ${formatEstimateAmount(estimate.totalPaise)}.`;
  const paymentReference = action?.operation === "pay" ? ` Estimate ${estimate.id}.` : "";
  return (
    <>
      <div className="estimate-actions">
        {options.map((option) => <Button key={option.label} variant={option.reason ? "secondary" : "primary"} disabled={refreshing} onClick={() => setAction(option)}>{option.label}</Button>)}
      </div>
      {action && (action.reason ? (
        <Modal isOpen onClose={isLoading ? undefined : close} closeOnOverlay={!isLoading} title={action.label} footer={
          <>
            <Button variant="secondary" disabled={isLoading} onClick={close}>Cancel</Button>
            <Button type="submit" form={formId} loading={isLoading}>{action.operation === "cancel" ? "Release worker" : action.decision === "RETURN" ? "Confirm return" : "Confirm rejection"}</Button>
          </>
        }>
          <p>{summary}</p>
          <form id={formId} onSubmit={confirm}>
            <Textarea label={action.operation === "cancel" ? "Cancellation reason" : action.decision === "RETURN" ? "Revision feedback" : "Rejection reason"} rows={3} required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} disabled={isLoading} error={error} />
          </form>
        </Modal>
      ) : (
        <ConfirmDialog isOpen onClose={close} onConfirm={confirm} title={action.label} loading={isLoading}
          confirmLabel={action.label} confirmVariant="primary"
          message={`${summary}${paymentReference} ${action.description}${error ? ` ${error}` : ""}`} />
      ))}
    </>
  );
}
