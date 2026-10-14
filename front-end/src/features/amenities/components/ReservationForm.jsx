import { useState } from "react";
import { Button, ErrorState, Input } from "../../../components/ui/index.js";
import {
  amenityService,
  money,
  windowPayload,
} from "../services/amenityService.js";
import { useAmenityMutation } from "./useAmenityMutation.js";
export function ReservationForm({ amenity, onBooked }) {
  const [values, setValues] = useState({
    startsAt: "",
    endsAt: "",
    attendees: 1,
  });
  const [quote, setQuote] = useState(null);
  const { busy, error, run } = useAmenityMutation();
  const field = (key) => ({
    value: values[key],
    disabled: busy,
    onChange: (e) => {
      setQuote(null);
      setValues((v) => ({ ...v, [key]: e.target.value }));
    },
  });
  return (
    <form
      className="amenity-stack"
      onSubmit={(e) => {
        e.preventDefault();
        setQuote(null);
        run(
          () => amenityService.availability(amenity.id, windowPayload(values)),
          "",
          setQuote,
        );
      }}
    >
      <p>
        Enter times in your device time zone (
        {Intl.DateTimeFormat().resolvedOptions().timeZone}). Facility hours use{" "}
        {amenity.timeZone}. Availability is checked again when reserving.
      </p>
      <Input
        label="Start"
        type="datetime-local"
        required
        {...field("startsAt")}
      />
      <Input label="End" type="datetime-local" required {...field("endsAt")} />
      <Input
        label="Attendees"
        type="number"
        min="1"
        max={amenity.capacity}
        step="1"
        required
        {...field("attendees")}
      />
      {error && <ErrorState message={error} />}
      <Button type="submit" loading={busy}>
        Check availability
      </Button>
      {quote && (
        <div className="amenity-stack" role="status">
          <p>
            Available • Fee {money(quote.feeMinor)} • Deposit{" "}
            {money(quote.depositMinor)}.{" "}
            {quote.requiresApproval
              ? "Administrator approval is required; your request holds capacity."
              : "Your booking will be approved immediately."}
          </p>
          <p>No online payment is collected. Any charges remain pending.</p>
          <Button
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  amenityService.book(amenity.id, {
                    ...windowPayload(values),
                    expectedFeeMinor: quote.feeMinor,
                    expectedDepositMinor: quote.depositMinor,
                  }),
                "Reservation created.",
                onBooked,
              )
            }
          >
            Reserve amenity
          </Button>
        </div>
      )}
    </form>
  );
}
