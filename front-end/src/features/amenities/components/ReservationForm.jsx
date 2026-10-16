import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "../../../components/ui/index.js";
import { useAsyncResource } from "../../../hooks/useAsyncResource.js";
import { amenityService, money } from "../services/amenityService.js";
import { useAmenityMutation } from "./useAmenityMutation.js";
import {
  facilityDate,
  bookingDateRange,
  reservationDateError,
  clockOf,
  matchingStarts,
  suggestedStarts,
  durationChoice,
} from "./reservationDates.js";

export function ReservationForm({
  amenity,
  booking,
  kind,
  onBooked,
  onBusyChange,
}) {
  const extending = kind === "EXTEND";
  const increment = amenity.bookingIntervalMinutes ?? 1;
  const existingMinutes = booking
    ? (Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60000
    : 0;
  const [date, setDate] = useState(() =>
    booking
      ? facilityDate(new Date(booking.startsAt), amenity.timeZone)
      : bookingDateRange(amenity.timeZone, amenity.advanceDays).minDate,
  );
  const [attendees, setAttendees] = useState(booking?.attendees ?? 1);
  const [startsAt, setStart] = useState(extending ? booking.startsAt : "");
  const [clock, setClock] = useState("");
  const [duration, setDuration] = useState(
    String(
      extending
        ? increment
        : booking
          ? existingMinutes
          : Math.ceil(amenity.minDurationMinutes / increment) * increment,
    ),
  );
  const retry = useRef(null);
  const { busy, error, run } = useAmenityMutation();
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  const loader = useCallback(
    (signal) => {
      if (
        !date ||
        !Number.isInteger(Number(attendees)) ||
        Number(attendees) < 1 ||
        Number(attendees) > amenity.capacity
      )
        return Promise.resolve(null);
      const values = {
        date,
        attendees: Number(attendees),
        ...(startsAt ? { startsAt } : {}),
      };
      return booking
        ? amenityService.changeOptions(booking.id, { ...values, kind }, signal)
        : amenityService.day(amenity.id, values, signal);
    },
    [
      date,
      attendees,
      startsAt,
      amenity.id,
      amenity.capacity,
      booking?.id,
      kind,
    ],
  );
  const availability = useAsyncResource(loader);
  const options = availability.data;
  const range =
    options?.bookingWindow ??
    bookingDateRange(amenity.timeZone, amenity.advanceDays);
  const dateError = extending ? "" : reservationDateError(date, range);
  const attendeeError =
    !Number.isInteger(Number(attendees)) ||
    Number(attendees) < 1 ||
    Number(attendees) > amenity.capacity
      ? `Enter a whole number from 1 to ${amenity.capacity}.`
      : "";
  const current =
    options?.date === date && options?.attendees === Number(attendees);
  const starts = current ? options.starts : [];
  const ends =
    current && options.selectedStartsAt === startsAt ? options.ends : [];
  const matches = matchingStarts(starts, clock);
  useEffect(() => {
    if (
      !extending &&
      current &&
      !availability.loading &&
      !availability.error &&
      matches.length === 1 &&
      startsAt !== matches[0].value
    )
      setStart(matches[0].value);
  }, [
    extending,
    current,
    options,
    clock,
    startsAt,
    availability.loading,
    availability.error,
  ]);
  const ready =
    !availability.loading &&
    !availability.error &&
    !dateError &&
    !attendeeError;
  const selected =
    ready &&
    starts.some((option) => option.value === startsAt) &&
    durationChoice(ends, duration, extending ? existingMinutes : 0);
  const startError =
    ready && clock && !matches.length
      ? "This start time is unavailable. Choose a suggestion or another time within opening hours."
      : "";
  const durationError =
    ready && startsAt && ends.length && !selected
      ? "This duration is unavailable. Choose one of the available durations below."
      : "";
  const durationValues = [
    ...new Set([
      ends[0]?.durationMinutes,
      ...[30, 60, 90, 120, 180, 240].map(
        (value) => value + (extending ? existingMinutes : 0),
      ),
    ]),
  ]
    .filter((value) => ends.some((option) => option.durationMinutes === value))
    .map((value) => value - (extending ? existingMinutes : 0));
  const timeLabel = (value) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: amenity.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "shortOffset",
    }).format(new Date(value));
  const chooseStart = (option) => {
    setStart(option.value);
    setClock(clockOf(option));
  };
  const reset = () => {
    setStart(extending ? booking.startsAt : "");
    setClock("");
  };
  async function submit(event) {
    event.preventDefault();
    if (!selected || busy) return;
    const payload = {
      startsAt,
      endsAt: selected.value,
      attendees: Number(attendees),
      ...(booking
        ? { kind, expectedVersion: options.version }
        : {
            expectedFeeMinor: options.feeMinor,
            expectedDepositMinor: options.depositMinor,
          }),
    };
    const fingerprint = JSON.stringify({
      ...payload,
      expectedVersion: undefined,
    });
    if (retry.current?.fingerprint !== fingerprint)
      retry.current = { fingerprint, id: crypto.randomUUID() };
    await run(
      () =>
        booking
          ? amenityService.change(booking.id, {
              ...payload,
              clientRequestId: retry.current.id,
            })
          : amenityService.book(amenity.id, {
              ...payload,
              clientRequestId: retry.current.id,
            }),
      booking ? "Booking change submitted." : "Reservation created.",
      onBooked,
    );
    await availability.reload();
  }
  return (
    <form className="amenity-stack amenity-reservation" onSubmit={submit}>
      <div className="amenity-reservation__rules">
        <strong>
          {amenity.opensAt} - {amenity.closesAt} ({amenity.timeZone})
        </strong>
        <span>
          {amenity.weekdays.length === 7
            ? "Every day"
            : amenity.weekdays
                .map(
                  (day) =>
                    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day],
                )
                .join(", ")}{" "}
          &middot; Up to {amenity.capacity} people
        </span>
        <span>
          {amenity.advanceDays
            ? `Book at least ${amenity.advanceDays} days before the start time.`
            : "Same-day booking allowed, subject to availability."}
        </span>
      </div>
      {booking && (
        <p className="amenity-note">
          Current booking: {timeLabel(booking.startsAt)} -{" "}
          {timeLabel(booking.endsAt)}. Your reservation stays in place while a
          change awaits approval.
        </p>
      )}
      <div className="amenity-grid">
        <Input
          label={`Reservation date (${amenity.timeZone})`}
          type="date"
          min={extending ? date : range.minDate}
          disabled={busy || extending}
          required
          value={date}
          error={dateError}
          hint={
            extending
              ? "The original booking date stays unchanged."
              : `Earliest date: ${range.minDate}. Minimum notice is checked against the exact start time.`
          }
          onChange={(event) => {
            setDate(event.target.value);
            reset();
          }}
        />
        <Input
          label="Attendees"
          type="number"
          min="1"
          max={amenity.capacity}
          step="1"
          required
          value={attendees}
          error={attendeeError}
          disabled={busy || Boolean(booking)}
          onChange={(event) => {
            setAttendees(event.target.value);
            reset();
          }}
        />
      </div>
      {!dateError && !attendeeError && (
        <section className="amenity-stack" aria-label="Reservation time">
          <div className="amenity-grid">
            {!extending && (
              <Input
                label={`Start time (${amenity.timeZone})`}
                type="time"
                min={amenity.opensAt}
                max={amenity.closesAt}
                step={increment * 60}
                required
                value={clock}
                disabled={busy}
                error={startError}
                hint="Pick a suggested time below, or enter an exact time."
                onChange={(event) => {
                  setClock(event.target.value);
                  const match = matchingStarts(starts, event.target.value);
                  setStart(match.length === 1 ? match[0].value : "");
                }}
              />
            )}
            <Input
              label={
                extending ? "Extra duration (minutes)" : "Duration (minutes)"
              }
              type="number"
              min={
                ends.length
                  ? ends[0].durationMinutes - (extending ? existingMinutes : 0)
                  : extending
                    ? increment
                    : amenity.minDurationMinutes
              }
              max={
                ends.length
                  ? ends[ends.length - 1].durationMinutes -
                    (extending ? existingMinutes : 0)
                  : amenity.maxDurationMinutes
              }
              step={increment}
              required
              value={duration}
              disabled={busy || !startsAt}
              error={durationError}
              hint={
                extending
                  ? "Only the additional time is entered here."
                  : `${amenity.minDurationMinutes}-${amenity.maxDurationMinutes} minutes per booking.`
              }
              onChange={(event) => setDuration(event.target.value)}
            />
          </div>
          {!extending && matches.length > 1 && (
            <Select
              label="Choose the time occurrence"
              required
              value={startsAt}
              disabled={busy || availability.loading}
              onChange={(event) => setStart(event.target.value)}
            >
              <option value="">Select UTC offset</option>
              {matches.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
          {availability.loading && (
            <LoadingState message="Checking available times..." />
          )}
          {availability.error && (
            <ErrorState
              message={availability.error.message}
              onRetry={availability.reload}
            />
          )}
          {!extending && starts.length > 0 && (
            <div>
              <p className="amenity-reservation__label">
                Suggested start times
              </p>
              <div className="amenity-actions">
                {suggestedStarts(starts).map((option) => (
                  <Button
                    key={option.value}
                    variant={
                      startsAt === option.value ? "primary" : "secondary"
                    }
                    aria-pressed={startsAt === option.value}
                    disabled={busy || availability.loading}
                    onClick={() => chooseStart(option)}
                  >
                    {matchingStarts(starts, clockOf(option)).length > 1
                      ? option.label
                      : clockOf(option)}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {startsAt && ends.length > 0 && (
            <div>
              <p className="amenity-reservation__label">
                {extending
                  ? "Available extra durations"
                  : "Available durations"}
              </p>
              <div className="amenity-actions">
                {durationValues.map((value) => (
                  <Button
                    key={value}
                    variant={
                      Number(duration) === value ? "primary" : "secondary"
                    }
                    aria-pressed={Number(duration) === value}
                    disabled={busy || availability.loading}
                    onClick={() => setDuration(String(value))}
                  >
                    {value} min
                  </Button>
                ))}
              </div>
            </div>
          )}
          {ready &&
            current &&
            (!starts.length ||
              (startsAt &&
                options.selectedStartsAt === startsAt &&
                !ends.length)) && (
              <EmptyState
                title="No bookable time"
                message={
                  options.unavailableReason?.message ||
                  "Choose another date or start time. Opening hours, capacity and existing holds apply."
                }
              />
            )}
          {current && options.unavailable.length > 0 && (
            <details>
              <summary>Reserved / restricted times</summary>
              <ul>
                {options.unavailable.map((window, index) => (
                  <li key={index}>
                    {timeLabel(window.startsAt)} - {timeLabel(window.endsAt)}:{" "}
                    {window.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      {selected && (
        <div className="amenity-reservation__summary" role="status">
          <strong>
            {timeLabel(startsAt)} - {timeLabel(selected.value)} &middot;{" "}
            {selected.durationMinutes} minutes total
          </strong>
          <span>
            Booking fee: {money(options.feeMinor)} &middot; Refundable deposit:{" "}
            {money(options.depositMinor)}
          </span>
          {booking && (
            <span>
              Approved extension fees:{" "}
              {money(options.approvedExtensionFeeMinor)} &middot; Additional
              fee: {money(selected.additionalFeeMinor)}
            </span>
          )}
          <strong>
            Total including deposit:{" "}
            {money(
              options.feeMinor +
                options.depositMinor +
                options.approvedExtensionFeeMinor +
                selected.additionalFeeMinor,
            )}
          </strong>
          <span>
            {options.requiresApproval
              ? "Admin approval required."
              : "Approved immediately if still available."}{" "}
            No online payment is collected.
          </span>
        </div>
      )}
      {error && <ErrorState message={error} />}
      <div className="amenity-actions">
        <Button
          variant="secondary"
          disabled={busy || availability.loading}
          onClick={() => availability.reload()}
        >
          Refresh times
        </Button>
        <Button type="submit" loading={busy} disabled={!selected}>
          {booking
            ? extending
              ? "Request extension"
              : "Request time change"
            : "Reserve amenity"}
        </Button>
      </div>
    </form>
  );
}
