import { useCallback, useState } from "react";
import { Button, ErrorState, LoadingState, Modal, Textarea, useToast } from "../../../components/ui/index.js";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { complaintNeedsVisit, formatVisit, isSlotPast } from "../utils/appointments.js";
import { formatEnum } from "../utils/formatters.js";
import { SlotPicker, useWorkerBookings } from "./SlotPicker.jsx";

export function RescheduleDecisionModal({ appointment, onClose, onDecided }) {
  const { showToast } = useToast();
  const request = appointment.rescheduleRequest;
  const loader = useCallback(() => towerRepresentativeService.listTimeSlots(), []);
  const { data: slots, error, initialLoading, reload } = useTowerResource(loader);
  const [date, setDate] = useState(request?.proposedDate || "");
  const [timeSlot, setTimeSlot] = useState(request?.proposedTimeSlot || "");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(null);
  const bookings = useWorkerBookings(appointment.workerId, date, appointment.id);
  const conflict = (bookings.data || []).some((slot) => slot.timeSlot === timeSlot);
  const busy = Boolean(pending);
  const emergency = Boolean(appointment.complaint?.isEmergency);
  const slotPast = isSlotPast(date, timeSlot, emergency);
  const closedComplaint = !complaintNeedsVisit(appointment.complaint);

  const handleClose = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);

  const decide = async (decision) => {
    if (decision === "APPROVE" && (!date || !timeSlot || conflict || slotPast || closedComplaint)) return;
    setPending(decision);
    try {
      await towerRepresentativeService.decideReschedule(appointment.id, { decision, scheduledDate: date, timeSlot, note: note.trim() });
      showToast({ type: "success", message: decision === "APPROVE" ? "Reschedule approved." : "Reschedule declined. The original visit stays confirmed." });
      setPending(null);
      onClose();
      await onDecided();
    } catch (requestError) {
      showToast({ type: "error", message: requestError.message || "Unable to process the reschedule request." });
      setPending(null);
      bookings.reload();
      onDecided();
    }
  };

  const submit = (event) => { event.preventDefault(); decide("APPROVE"); };

  return (
    <Modal
      isOpen
      onClose={handleClose}
      closeOnOverlay={!busy}
      title="Process reschedule request"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>Close</Button>
          <Button variant="secondary" onClick={() => decide("DECLINE")} loading={pending === "DECLINE"} loadingLabel="Declining..." disabled={busy}>Decline request</Button>
          <Button type="submit" form="tr-reschedule-decision" loading={pending === "APPROVE"} loadingLabel="Approving..." disabled={busy || !date || !timeSlot || conflict || slotPast || closedComplaint || !slots}>
            Approve reschedule
          </Button>
        </>
      }
    >
      <dl className="tr-details tr-modal-intro">
        <div><dt>Current visit</dt><dd>{formatVisit(appointment.scheduledDate, appointment.scheduledTimeSlot)}</dd></div>
        <div><dt>Requested visit</dt><dd>{formatVisit(request?.proposedDate, request?.proposedTimeSlot)}</dd></div>
        <div className="tr-grid__wide"><dt>Resident reason</dt><dd>{request?.reason || "Not provided"}</dd></div>
      </dl>
      {closedComplaint && <p className="tr-inline-error" role="alert">The complaint is {formatEnum(appointment.complaint?.status)} and no longer needs a visit. Decline the request or cancel the appointment.</p>}
      {initialLoading && <LoadingState message="Loading time slots..." />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {slots && (
        <form id="tr-reschedule-decision" className="tr-form" onSubmit={submit}>
          <SlotPicker idPrefix="tr-reschedule" slots={slots} date={date} timeSlot={timeSlot} onDateChange={setDate} onSlotChange={setTimeSlot} bookings={bookings} disabled={busy} emergency={emergency} />
          {slotPast && <p className="tr-inline-error" role="alert">{emergency ? "This slot has already ended." : "This slot has already started."} Choose a later date or time slot.</p>}
          {conflict && <p className="tr-inline-error" role="alert">{appointment.workerName || "The worker"} already has a confirmed visit in this slot. Choose another slot or decline.</p>}
          <Textarea label="Note to resident (optional)" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} disabled={busy} />
        </form>
      )}
    </Modal>
  );
}
