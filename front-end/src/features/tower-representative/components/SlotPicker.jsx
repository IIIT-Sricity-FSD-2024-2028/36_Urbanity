import { useMemo } from "react";
import { Input, Select } from "../../../components/ui/index.js";
import { MAX_BOOKING_HORIZON_DAYS } from "../../../constants/appointments.js";
import { useTowerWorkerSchedule } from "../services/towerAppointmentsApi.js";
import { isSlotPast, localToday } from "../utils/appointments.js";

function maxBookingDate() {
  const date = new Date();
  date.setDate(date.getDate() + MAX_BOOKING_HORIZON_DAYS - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Loads the worker's confirmed bookings for the chosen date so the representative can
// see conflicts before submitting. The backend re-validates conflicts on confirmation.
// The cache is keyed by worker and date, so revisiting a date reuses its entry
// and a slow response for an earlier date cannot overwrite the selected one.
export function useWorkerBookings(workerId, date, ignoreAppointmentId) {
  const schedule = useTowerWorkerSchedule(workerId, date);
  const data = useMemo(() => (schedule.data
    ? (schedule.data.bookedSlots || []).filter((slot) => slot.appointmentId !== ignoreAppointmentId)
    : null), [schedule.data, ignoreAppointmentId]);
  return { ...schedule, data };
}

export function SlotPicker({ slots, date, timeSlot, onDateChange, onSlotChange, bookings, disabled, idPrefix, emergency = false }) {
  const booked = new Set((bookings?.data || []).map((slot) => slot.timeSlot));
  return (
    <div className="tr-slot-picker">
      <Input
        id={`${idPrefix}-date`}
        label="Visit date"
        type="date"
        required
        min={localToday()}
        max={maxBookingDate()}
        value={date}
        onChange={(event) => onDateChange(event.target.value)}
        disabled={disabled}
      />
      <Select
        id={`${idPrefix}-slot`}
        label="Time slot"
        required
        value={timeSlot}
        onChange={(event) => onSlotChange(event.target.value)}
        disabled={disabled}
        hint={bookings?.loading ? "Checking worker availability..." : bookings?.error ? `Availability unavailable: ${bookings.error.message}` : undefined}
      >
        <option value="">Choose a slot</option>
        {slots.map((slot) => {
          const past = isSlotPast(date, slot.code, emergency);
          const taken = booked.has(slot.code);
          return (
            <option key={slot.code} value={slot.code} disabled={past || taken}>
              {slot.label}{taken ? " (worker booked)" : past ? (emergency ? " (ended)" : " (started)") : ""}
            </option>
          );
        })}
      </Select>
    </div>
  );
}
