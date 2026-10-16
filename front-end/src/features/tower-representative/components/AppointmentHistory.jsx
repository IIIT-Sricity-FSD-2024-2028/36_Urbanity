import { StatusBadge } from "../../../components/data-display/index.js";
import { APPOINTMENT_ACTION_LABELS } from "../../../constants/appointments.js";
import { formatVisit } from "../utils/appointments.js";
import { formatDateTime, formatEnum } from "../utils/formatters.js";

export function AppointmentHistory({ history = [] }) {
  if (!history.length) return <p className="tr-muted">No appointment history is available.</p>;
  return (
    <ol className="tr-timeline">
      {history.map((entry, index) => (
        <li key={`${entry.action}-${entry.changedAt}-${index}`} className={index === history.length - 1 ? "tr-timeline__item--current" : undefined}>
          <span className="tr-history-heading">
            <strong>{APPOINTMENT_ACTION_LABELS[entry.action] || formatEnum(entry.action)}</strong>
            <StatusBadge status={entry.status} />
          </span>
          {entry.date && (
            <span>
              {entry.previousDate && <><s className="tr-muted">{formatVisit(entry.previousDate, entry.previousTimeSlot)}</s> → </>}
              {formatVisit(entry.date, entry.timeSlot)}
            </span>
          )}
          {entry.note && <span className="tr-history-note">“{entry.note}”</span>}
          <span className="tr-muted">{formatDateTime(entry.changedAt)} · {formatEnum(entry.changedByRole)}</span>
        </li>
      ))}
    </ol>
  );
}
