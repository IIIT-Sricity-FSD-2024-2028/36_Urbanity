export function facilityDate(value, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(value)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function bookingDateRange(timeZone, advanceDays, now = Date.now()) {
  const earliest = now + advanceDays * 86400000;
  return {
    minDate: facilityDate(new Date(earliest), timeZone),
    earliestStartsAt: new Date(earliest).toISOString(),
  };
}
export function reservationDateError(date, range) {
  if (!date) return "Choose a booking date.";
  if (date < range.minDate)
    return `Choose ${range.minDate} or later to meet the minimum booking notice.`;
  return "";
}
export const clockOf = (option) => option.label.slice(0, 5);
export function matchingStarts(starts, clock) {
  return starts.filter((option) => clockOf(option) === clock);
}
export function suggestedStarts(starts, limit = 12) {
  return starts
    .filter(
      (option, index) =>
        index === 0 || Number(clockOf(option).slice(3)) % 30 === 0,
    )
    .slice(0, limit);
}
export function durationChoice(ends, minutes, existingMinutes = 0) {
  if (
    String(minutes).trim() === "" ||
    !Number.isInteger(Number(minutes)) ||
    Number(minutes) <= 0
  )
    return undefined;
  return ends.find(
    (option) => option.durationMinutes === Number(minutes) + existingMinutes,
  );
}
