import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingDateRange,
  facilityDate,
  reservationDateError,
  matchingStarts,
  suggestedStarts,
  durationChoice,
} from "./reservationDates.js";
test("X days before means minimum notice, not a maximum future date", () => {
  const range = bookingDateRange(
    "Asia/Kolkata",
    6,
    Date.parse("2026-10-16T20:00:00Z"),
  );
  assert.deepEqual(range, {
    minDate: "2026-10-23",
    earliestStartsAt: "2026-10-22T20:00:00.000Z",
  });
  assert.match(
    reservationDateError("2026-10-20", range),
    /minimum booking notice/,
  );
  assert.equal(reservationDateError("2026-10-31", range), "");
  assert.equal(reservationDateError("2026-10-23", range), "");
});
test("notice uses elapsed 24-hour days across daylight saving changes", () => {
  const range = bookingDateRange(
    "America/New_York",
    1,
    Date.parse("2026-10-31T16:00:00Z"),
  );
  assert.equal(range.minDate, "2026-11-01");
  assert.equal(range.earliestStartsAt, "2026-11-01T16:00:00.000Z");
  assert.equal(
    facilityDate(new Date("2026-11-01T01:00:00Z"), "America/New_York"),
    "2026-10-31",
  );
});
test("server-provided notice takes precedence and zero days permits today", () => {
  assert.match(
    reservationDateError("2026-10-20", { minDate: "2026-10-22" }),
    /2026-10-22/,
  );
  assert.equal(
    bookingDateRange("UTC", 0, Date.parse("2026-10-16T10:00:00Z")).minDate,
    "2026-10-16",
  );
  assert.match(reservationDateError("", { minDate: "2026-10-16" }), /Choose/);
});
test("suggested times are real server choices without a minute-by-minute dropdown", () => {
  const starts = Array.from({ length: 180 }, (_, i) => ({
    value: `instant-${i}`,
    label: `${String(17 + Math.floor((30 + i) / 60)).padStart(2, "0")}:${String((30 + i) % 60).padStart(2, "0")} GMT+5:30`,
  }));
  const suggestions = suggestedStarts(starts);
  assert.ok(suggestions.length <= 12);
  assert.ok(suggestions.length < starts.length);
  assert.equal(suggestions[0], starts[0]);
  assert.ok(suggestions.every((option) => starts.includes(option)));
  assert.equal(matchingStarts(starts, "18:17")[0].value, "instant-47");
});
test("repeated clocks stay distinct and unavailable durations cannot be submitted", () => {
  const starts = [
    { value: "2026-11-01T05:30:00Z", label: "01:30 GMT-4" },
    { value: "2026-11-01T06:30:00Z", label: "01:30 GMT-5" },
  ];
  assert.equal(matchingStarts(starts, "01:30").length, 2);
  const ends = [
    { value: "end-60", durationMinutes: 60 },
    { value: "end-90", durationMinutes: 90, additionalFeeMinor: 250 },
  ];
  assert.equal(durationChoice(ends, "60")?.value, "end-60");
  assert.equal(durationChoice(ends, "75"), undefined);
  assert.equal(durationChoice(ends, ""), undefined);
  assert.equal(durationChoice(ends, "30", 60)?.value, "end-90");
  assert.equal(durationChoice(ends, "0", 60), undefined);
});
