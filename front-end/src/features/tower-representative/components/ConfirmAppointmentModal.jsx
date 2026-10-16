import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorState, LoadingState, Modal, useToast } from "../../../components/ui/index.js";
import { RatingStars, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { complaintNeedsVisit, formatVisit, isSlotPast } from "../utils/appointments.js";
import { formatEnum, workerReference } from "../utils/formatters.js";
import { SlotPicker, useWorkerBookings } from "./SlotPicker.jsx";

// Worker choices reuse the complaint assignment rules: an already-assigned complaint keeps its
// worker; an UNDER_REVIEW complaint offers the backend's eligible workers and is assigned on confirm.
export function ConfirmAppointmentModal({ appointment, onClose, onConfirmed }) {
  const { showToast } = useToast();
  const complaint = appointment.complaint;
  const loader = useCallback(async () => {
    const [slots, workers] = await Promise.all([
      towerRepresentativeService.listTimeSlots(),
      complaint.assignedWorkerId
        ? towerRepresentativeService.getWorker(complaint.assignedWorkerId).then((worker) => [worker])
        : complaint.status === "UNDER_REVIEW"
          ? towerRepresentativeService.listEligibleWorkers(complaint.id)
          : Promise.resolve([]),
    ]);
    return { slots, workers };
  }, [complaint.assignedWorkerId, complaint.id, complaint.status]);
  const { data, error, initialLoading, reload } = useTowerResource(loader);
  const [workerId, setWorkerId] = useState(complaint.assignedWorkerId || "");
  const [date, setDate] = useState(appointment.requestedDate);
  const [timeSlot, setTimeSlot] = useState(appointment.requestedTimeSlot);
  const [submitting, setSubmitting] = useState(false);
  const bookings = useWorkerBookings(workerId, date, appointment.id);
  const conflict = (bookings.data || []).some((slot) => slot.timeSlot === timeSlot);
  const needsReview = complaint.status === "SUBMITTED";
  const closedComplaint = !complaintNeedsVisit(complaint);
  const emergency = Boolean(complaint?.isEmergency);
  const slotPast = isSlotPast(date, timeSlot, emergency);

  const handleClose = useCallback(() => { if (!submitting) onClose(); }, [onClose, submitting]);

  const submit = async (event) => {
    event.preventDefault();
    if (!workerId || !date || !timeSlot || conflict || slotPast || closedComplaint) return;
    setSubmitting(true);
    try {
      await towerRepresentativeService.confirmAppointment(appointment.id, { workerId, scheduledDate: date, timeSlot });
      showToast({ type: "success", message: complaint.assignedWorkerId ? "Appointment confirmed." : "Appointment confirmed and worker assigned to the complaint." });
      setSubmitting(false);
      onClose();
      await onConfirmed();
    } catch (requestError) {
      showToast({ type: "error", message: requestError.message || "Unable to confirm the appointment." });
      setSubmitting(false);
      bookings.reload();
      // The appointment may have changed meanwhile (e.g. cancelled by the resident); refresh the page data.
      onConfirmed();
    }
  };

  return (
    <Modal
      isOpen
      onClose={handleClose}
      closeOnOverlay={!submitting}
      title="Confirm appointment"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="tr-confirm-appointment" loading={submitting} loadingLabel="Confirming..." disabled={needsReview || closedComplaint || !workerId || !date || !timeSlot || conflict || slotPast}>
            Confirm appointment
          </Button>
        </>
      }
    >
      {emergency && <p className="tr-modal-intro"><Badge variant="danger">Emergency</Badge> <span className="tr-muted">Emergency complaint: confirm the earliest possible slot. The slot running now can be used.</span></p>}
      <p className="tr-muted tr-modal-intro">
        Resident preference: <strong>{formatVisit(appointment.requestedDate, appointment.requestedTimeSlot)}</strong>.
        You may confirm a different slot if the worker is unavailable.
      </p>
      {closedComplaint && (
        <EmptyState title="Complaint no longer needs a visit" message={`The complaint is ${formatEnum(complaint.status)}. Cancel this request instead of confirming it.`} />
      )}
      {needsReview && (
        <EmptyState
          title="Complaint review not started"
          message="Move the complaint to Under Review before confirming a visit."
          action={<Link className="ui-button ui-button--primary tr-link-button" to={`${ROUTES.TOWER_REPRESENTATIVE_COMPLAINTS}/${complaint.id}`}>Open complaint</Link>}
        />
      )}
      {!needsReview && !closedComplaint && initialLoading && <LoadingState message="Loading workers and time slots..." />}
      {!needsReview && !closedComplaint && error && <ErrorState message={error.message} onRetry={reload} />}
      {!needsReview && !closedComplaint && data && (
        <form id="tr-confirm-appointment" className="tr-form" onSubmit={submit}>
          <fieldset className="tr-worker-options" disabled={submitting || Boolean(complaint.assignedWorkerId)}>
            <legend className="tr-subheading">
              {complaint.assignedWorkerId ? "Assigned worker" : `Eligible ${formatEnum(complaint.requiredWorkType)} workers`}
            </legend>
            {!data.workers.length && (
              <EmptyState title="No eligible workers" message="No available worker with the required specialization exists in your community right now." />
            )}
            {data.workers.map((worker) => (
              <label key={worker.id} className={`tr-worker-option${workerId === worker.id ? " tr-worker-option--selected" : ""}`}>
                <input type="radio" name="workerId" value={worker.id} checked={workerId === worker.id} onChange={() => setWorkerId(worker.id)} />
                <span className="tr-cell-stack">
                  <strong>{workerReference(worker)}</strong>
                  <span className="tr-muted">{formatEnum(worker.specialization)} · <RatingStars value={worker.rating} /> · {worker.completedWorkCount || 0} completed</span>
                </span>
                <StatusBadge status={worker.status} />
              </label>
            ))}
          </fieldset>
          {complaint.assignedWorkerId && <p className="tr-muted tr-note">Visits for an assigned complaint always use the assigned worker.</p>}
          {!complaint.assignedWorkerId && workerId && <p className="tr-muted tr-note">Confirming also assigns this worker to the complaint (Under Review → Assigned).</p>}
          <SlotPicker
            idPrefix="tr-confirm"
            slots={data.slots}
            date={date}
            timeSlot={timeSlot}
            onDateChange={setDate}
            onSlotChange={setTimeSlot}
            bookings={workerId ? bookings : null}
            disabled={submitting}
            emergency={emergency}
          />
          {slotPast && <p className="tr-inline-error" role="alert">{emergency ? "This slot has already ended." : "This slot has already started."} Choose a later date or time slot.</p>}
          {conflict && <p className="tr-inline-error" role="alert">The selected worker already has a confirmed visit in this slot. Choose another slot.</p>}
        </form>
      )}
    </Modal>
  );
}
