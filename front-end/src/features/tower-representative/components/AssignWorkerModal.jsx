import { useCallback, useState } from "react";
import { Button, EmptyState, ErrorState, LoadingState, Modal, useToast } from "../../../components/ui/index.js";
import { RatingStars, StatusBadge } from "../../../components/data-display/index.js";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { formatEnum, workerReference } from "../utils/formatters.js";

export function AssignWorkerModal({ complaint, onClose, onAssigned }) {
  const { showToast } = useToast();
  const loader = useCallback(async () => {
    const workers = await towerRepresentativeService.listEligibleWorkers(complaint.id);
    return [...workers].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || Number(b.completedWorkCount || 0) - Number(a.completedWorkCount || 0));
  }, [complaint.id]);
  const { data: workers, error, initialLoading, reload } = useTowerResource(loader);
  const [selectedId, setSelectedId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    if (!submitting) onClose();
  }, [onClose, submitting]);

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await towerRepresentativeService.assignWorker(complaint.id, selectedId);
      showToast({ type: "success", message: "Worker assigned. The complaint is now Assigned." });
      setSubmitting(false);
      onClose();
      await onAssigned();
    } catch (requestError) {
      showToast({ type: "error", message: requestError.message || "Unable to assign the worker." });
      setSubmitting(false);
      setSelectedId("");
      reload();
      onAssigned();
    }
  };

  return (
    <Modal
      isOpen
      onClose={handleClose}
      closeOnOverlay={!submitting}
      title="Assign maintenance worker"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="tr-assign-form" loading={submitting} loadingLabel="Assigning..." disabled={!selectedId}>
            Assign worker
          </Button>
        </>
      }
    >
      <p className="tr-muted tr-modal-intro">
        Eligible workers are provided by the backend: available community workers whose specialization matches
        <strong> {formatEnum(complaint.requiredWorkType)}</strong> and who have no active assignment.
      </p>
      {initialLoading && <LoadingState message="Loading eligible workers..." />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {workers && !workers.length && (
        <EmptyState
          title="No eligible workers"
          message="No available worker with the required specialization exists in your community right now. Try again later or contact the Community Admin."
        />
      )}
      {workers?.length > 0 && (
        <form id="tr-assign-form" onSubmit={submit}>
          <fieldset className="tr-worker-options" disabled={submitting}>
            <legend className="sr-only">Select a worker</legend>
            {workers.map((worker) => (
              <label key={worker.id} className={`tr-worker-option${selectedId === worker.id ? " tr-worker-option--selected" : ""}`}>
                <input
                  type="radio"
                  name="workerId"
                  value={worker.id}
                  checked={selectedId === worker.id}
                  onChange={() => setSelectedId(worker.id)}
                />
                <span className="tr-cell-stack">
                  <strong>{workerReference(worker)}</strong>
                  <span className="tr-muted">
                    {formatEnum(worker.specialization)} · <RatingStars value={worker.rating} /> · {worker.completedWorkCount || 0} completed
                  </span>
                </span>
                <StatusBadge status={worker.status} />
              </label>
            ))}
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
