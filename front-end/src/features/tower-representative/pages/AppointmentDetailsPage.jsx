import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Badge, Button, Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { AppointmentHistory } from "../components/AppointmentHistory.jsx";
import { AppointmentReasonModal } from "../components/AppointmentReasonModal.jsx";
import { ConfirmAppointmentModal } from "../components/ConfirmAppointmentModal.jsx";
import { RescheduleDecisionModal } from "../components/RescheduleDecisionModal.jsx";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { complaintNeedsVisit, formatVisit, hasSlotStarted, isActiveAppointment } from "../utils/appointments.js";
import { formatDateTime, formatEnum } from "../utils/formatters.js";

const GUIDANCE = Object.freeze({
  REQUESTED: "The resident requested a visit. Confirm it with an eligible worker after checking availability, or cancel it with a reason.",
  RESCHEDULE_REQUESTED: "The resident asked to move a confirmed visit. Approve a new slot or decline to keep the current visit.",
  CONFIRMED: "The visit is confirmed. The assigned worker records arrival and the outcome. You can mark the visit missed once the slot has started.",
  COMPLETED: "The worker completed this visit. Complaint resolution and verification continue separately on the complaint.",
  CANCELLED: "This appointment was cancelled.",
  MISSED: "This visit was missed. The resident can request a new appointment if work is still required.",
});

const settledValue = (result) => (result.status === "fulfilled" ? result.value : null);

export function AppointmentDetailsPage() {
  const { appointmentId } = useParams();
  const { user } = useAuth();
  const [dialog, setDialog] = useState(null);

  const loader = useCallback(async () => {
    const appointment = await towerRepresentativeService.getAppointment(appointmentId);
    const [resident] = await Promise.allSettled([towerRepresentativeService.getResidentHierarchy(appointment.residentId)]);
    return { appointment, resident: settledValue(resident) };
  }, [appointmentId]);
  const { data, error, initialLoading, loading, reload } = useTowerResource(loader);
  const closeDialog = useCallback(() => setDialog(null), []);

  const backLink = <Link className="ui-button ui-button--secondary tr-link-button" to={ROUTES.TOWER_REPRESENTATIVE_APPOINTMENTS}>Back to appointments</Link>;

  if (initialLoading) return <LoadingState message="Loading appointment..." />;
  if (error || !data) {
    return (
      <>
        <PageHeader eyebrow="Appointment" title="Appointment unavailable" actions={backLink} />
        <Card><ErrorState message={error?.message || "Unable to load this appointment."} onRetry={reload} /></Card>
      </>
    );
  }

  const { appointment, resident } = data;
  const { complaint } = appointment;
  const responsible = complaint?.responsibleUserId === user?.id;
  const active = isActiveAppointment(appointment);
  const canMarkMissed = appointment.status === "CONFIRMED" && hasSlotStarted(appointment) && !appointment.arrivedAt;
  const canCancel = active && !appointment.arrivedAt;
  const staleComplaint = active && !complaintNeedsVisit(complaint);
  const outcome = appointment.outcome;

  return (
    <>
      <PageHeader
        eyebrow="Appointment"
        title={complaint?.title || "Appointment"}
        description={`${complaint?.location?.towerName || "Tower"} · ${complaint?.location?.apartmentNumber || "Apartment unavailable"} · ${formatEnum(complaint?.requiredWorkType)}`}
        actions={<>{backLink}<Button variant="secondary" onClick={reload} loading={loading && Boolean(data)} loadingLabel="Refreshing...">Refresh</Button></>}
      />
      <div className="tr-detail-layout">
        <div className="tr-detail-main">
          <Card title="Next step" className="tr-next-step">
            <div className="tr-next-step__body">
              <StatusBadge status={appointment.status} />
              {complaint?.isEmergency && <Badge variant="danger">Emergency</Badge>}
              <p>{GUIDANCE[appointment.status]}</p>
            </div>
            {responsible && active && (
              <div className="tr-actions">
                {appointment.status === "REQUESTED" && <Button onClick={() => setDialog("confirm")}>Confirm visit</Button>}
                {appointment.status === "RESCHEDULE_REQUESTED" && <Button onClick={() => setDialog("reschedule")}>Process reschedule</Button>}
                {canMarkMissed && <Button variant="secondary" onClick={() => setDialog("missed")}>Mark as missed</Button>}
                {canCancel && <Button variant="danger" onClick={() => setDialog("cancel")}>Cancel appointment</Button>}
              </div>
            )}
            {responsible && staleComplaint && (
              <p className="tr-inline-error tr-note" role="status">The complaint is now {formatEnum(complaint?.status)} and no longer needs a visit. Cancel this appointment so the worker's slot is released.</p>
            )}
            {responsible && appointment.arrivedAt && appointment.status === "CONFIRMED" && (
              <p className="tr-muted tr-note">The worker has arrived. The worker records the visit outcome.</p>
            )}
            {!responsible && (
              <p className="tr-muted tr-note">{complaint?.responsibleUserName || "Another authority"} is responsible for this complaint, so appointment actions are not available to you.</p>
            )}
          </Card>

          <Card title="Visit">
            <dl className="tr-details">
              <div><dt>Resident preference</dt><dd>{formatVisit(appointment.requestedDate, appointment.requestedTimeSlot)}</dd></div>
              <div><dt>Scheduled visit</dt><dd>{formatVisit(appointment.scheduledDate, appointment.scheduledTimeSlot)}</dd></div>
              <div><dt>Assigned worker</dt><dd>{appointment.workerName || "Not assigned"}</dd></div>
              <div><dt>Confirmed</dt><dd>{appointment.confirmedAt ? formatDateTime(appointment.confirmedAt) : "Not confirmed"}</dd></div>
              <div><dt>Worker arrival</dt><dd>{appointment.arrivedAt ? formatDateTime(appointment.arrivedAt) : "Not recorded"}</dd></div>
              <div><dt>Requested</dt><dd>{formatDateTime(appointment.createdAt)}</dd></div>
              {appointment.residentNotes && <div className="tr-grid__wide"><dt>Resident notes</dt><dd>{appointment.residentNotes}</dd></div>}
            </dl>
          </Card>

          {appointment.rescheduleRequest && (
            <Card title="Pending reschedule request">
              <dl className="tr-details">
                <div><dt>Proposed visit</dt><dd>{formatVisit(appointment.rescheduleRequest.proposedDate, appointment.rescheduleRequest.proposedTimeSlot)}</dd></div>
                <div><dt>Requested</dt><dd>{formatDateTime(appointment.rescheduleRequest.requestedAt)}</dd></div>
                <div className="tr-grid__wide"><dt>Reason</dt><dd>{appointment.rescheduleRequest.reason}</dd></div>
              </dl>
            </Card>
          )}

          {outcome && (
            <Card title="Visit outcome">
              <dl className="tr-details">
                <div><dt>Outcome</dt><dd><StatusBadge status={outcome.outcome} /></dd></div>
                <div><dt>Recorded</dt><dd>{formatDateTime(outcome.recordedAt)} · {formatEnum(outcome.recordedByRole)}</dd></div>
                <div><dt>Follow-up visit</dt><dd>{outcome.followUpRequired ? "Required" : "Not required"}</dd></div>
                <div><dt>Photos</dt><dd>{outcome.attachmentIds?.length ? `${outcome.attachmentIds.length} on the complaint` : "None"}</dd></div>
                <div className="tr-grid__wide"><dt>Notes</dt><dd>{outcome.notes}</dd></div>
              </dl>
            </Card>
          )}

          {appointment.cancellation && (
            <Card title="Cancellation">
              <dl className="tr-details">
                <div><dt>Cancelled</dt><dd>{formatDateTime(appointment.cancellation.cancelledAt)}</dd></div>
                <div><dt>Cancelled by</dt><dd>{formatEnum(appointment.cancellation.cancelledByRole)}</dd></div>
                <div className="tr-grid__wide"><dt>Reason</dt><dd>{appointment.cancellation.reason}</dd></div>
              </dl>
            </Card>
          )}
        </div>

        <aside className="tr-detail-side">
          <Card title="Complaint" actions={<Link className="tr-inline-link" to={`${ROUTES.TOWER_REPRESENTATIVE_COMPLAINTS}/${complaint?.id}`}>Open</Link>}>
            <dl className="tr-details tr-details--single">
              <div><dt>Complaint status</dt><dd><StatusBadge status={complaint?.status} /></dd></div>
              <div><dt>Type</dt><dd>{formatEnum(complaint?.type)}</dd></div>
              <div><dt>Description</dt><dd>{complaint?.description || "No description provided."}</dd></div>
            </dl>
          </Card>
          <Card title="Resident & location">
            <dl className="tr-details tr-details--single">
              <div><dt>Resident</dt><dd>{resident?.user?.name || "Not available"}</dd></div>
              {resident?.user?.phone && <div><dt>Phone</dt><dd>{resident.user.phone}</dd></div>}
              <div><dt>Apartment</dt><dd>{complaint?.location?.apartmentNumber || "Not available"}</dd></div>
              <div><dt>Floor</dt><dd>{complaint?.location?.floorLabel || "Not available"}</dd></div>
              <div><dt>Tower</dt><dd>{complaint?.location?.towerName || "Not available"}</dd></div>
            </dl>
          </Card>
          <Card title="Appointment history">
            <AppointmentHistory history={appointment.history} />
          </Card>
        </aside>
      </div>

      {dialog === "confirm" && <ConfirmAppointmentModal appointment={appointment} onClose={closeDialog} onConfirmed={reload} />}
      {dialog === "reschedule" && <RescheduleDecisionModal appointment={appointment} onClose={closeDialog} onDecided={reload} />}
      {dialog === "cancel" && (
        <AppointmentReasonModal
          title="Cancel appointment"
          intro="The resident will see the cancellation and your reason. The complaint itself is not changed."
          label="Cancellation reason"
          confirmLabel="Cancel appointment"
          loadingLabel="Cancelling..."
          success="Appointment cancelled."
          onSubmit={(reason) => towerRepresentativeService.cancelAppointment(appointment.id, reason)}
          onClose={closeDialog}
          onDone={reload}
        />
      )}
      {dialog === "missed" && (
        <AppointmentReasonModal
          title="Mark visit as missed"
          intro="Use this when the visit did not take place. The resident can request a new appointment."
          label="What happened?"
          confirmLabel="Mark as missed"
          loadingLabel="Saving..."
          success="Visit marked as missed."
          confirmVariant="primary"
          onSubmit={(reason) => towerRepresentativeService.markAppointmentMissed(appointment.id, reason)}
          onClose={closeDialog}
          onDone={reload}
        />
      )}
    </>
  );
}
