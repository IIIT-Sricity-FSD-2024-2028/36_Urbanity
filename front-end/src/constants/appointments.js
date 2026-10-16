// Mirrors the backend appointment enums. The backend enforces every transition;
// these values are used only for display and filtering.
export const APPOINTMENT_STATUSES = Object.freeze([
  "REQUESTED",
  "CONFIRMED",
  "RESCHEDULE_REQUESTED",
  "COMPLETED",
  "CANCELLED",
  "MISSED",
]);

export const ACTIVE_APPOINTMENT_STATUSES = Object.freeze(["REQUESTED", "CONFIRMED", "RESCHEDULE_REQUESTED"]);

// Complaint statuses for which the backend accepts appointment requests.
export const SCHEDULABLE_COMPLAINT_STATUSES = Object.freeze(["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"]);

export const APPOINTMENT_ACTION_LABELS = Object.freeze({
  REQUESTED: "Appointment requested",
  REQUEST_UPDATED: "Preferred slot changed",
  CONFIRMED: "Appointment confirmed",
  RESCHEDULE_REQUESTED: "Reschedule requested",
  RESCHEDULE_APPROVED: "Reschedule approved",
  RESCHEDULE_DECLINED: "Reschedule declined",
  ARRIVED: "Worker arrived",
  COMPLETED: "Visit completed",
  MISSED: "Visit missed",
  CANCELLED: "Appointment cancelled",
});

// Business-rule values enforced by the backend, shown to users as guidance.
export const RESIDENT_CHANGE_CUTOFF_HOURS = 2;
export const MAX_BOOKING_HORIZON_DAYS = 60;
