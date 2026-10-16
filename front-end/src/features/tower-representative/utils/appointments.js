import { ACTIVE_APPOINTMENT_STATUSES, SCHEDULABLE_COMPLAINT_STATUSES } from "../../../constants/appointments.js";

// UI grouping only; the backend validates every appointment transition.
export const APPOINTMENT_VIEWS = Object.freeze([
  { value: "PENDING", label: "Pending" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "MISSED", label: "Missed" },
]);

export function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function slotStart(date, timeSlot) {
  if (!date || !timeSlot) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = timeSlot.split("-")[0].split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

export function formatVisitDate(date) {
  if (!date) return "Not scheduled";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export function formatSlot(timeSlot) {
  return timeSlot ? timeSlot.replace("-", " – ") : "";
}

export function formatVisit(date, timeSlot) {
  return date ? `${formatVisitDate(date)} · ${formatSlot(timeSlot)}` : "Not scheduled";
}

export function appointmentView(appointment) {
  if (appointment.status === "REQUESTED" || appointment.status === "RESCHEDULE_REQUESTED") return "PENDING";
  if (appointment.status === "CONFIRMED") return "UPCOMING";
  return appointment.status;
}

export function isActiveAppointment(appointment) {
  return ACTIVE_APPOINTMENT_STATUSES.includes(appointment?.status);
}

export function hasSlotStarted(appointment) {
  const start = slotStart(appointment.scheduledDate, appointment.scheduledTimeSlot);
  return Boolean(start && start.getTime() <= Date.now());
}

export function slotEnd(date, timeSlot) {
  if (!date || !timeSlot) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = timeSlot.split("-")[1].split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

// Mirrors the backend: emergencies may use the running slot until it ends; others must not have started.
export function isSlotPast(date, timeSlot, emergency = false) {
  const limit = emergency ? slotEnd(date, timeSlot) : slotStart(date, timeSlot);
  return Boolean(limit && limit.getTime() <= Date.now());
}

// Emergencies first, then the given order.
export function emergencyFirst(items, getComplaint = (item) => item.complaint) {
  return [...items].sort((a, b) => Number(Boolean(getComplaint(b)?.isEmergency)) - Number(Boolean(getComplaint(a)?.isEmergency)));
}

// Mirrors the backend rule: only complaints that still need on-site work can be scheduled.
export function complaintNeedsVisit(complaint) {
  return SCHEDULABLE_COMPLAINT_STATUSES.includes(complaint?.status);
}

export function visitSortKey(appointment) {
  return `${appointment.scheduledDate || appointment.requestedDate}${appointment.scheduledTimeSlot || appointment.requestedTimeSlot}`;
}
