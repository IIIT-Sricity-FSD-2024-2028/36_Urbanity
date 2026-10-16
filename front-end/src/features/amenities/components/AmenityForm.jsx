import { useEffect, useRef, useState } from "react";
import { Input, Select, Textarea } from "../../../components/ui/index.js";
import { prepareAmenity } from "./amenityFormValues.js";

export const defaults = {
  name: "",
  description: "",
  status: "ACTIVE",
  timeZone: "Asia/Kolkata",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "22:00",
  capacity: 1,
  exclusive: true,
  minDurationMinutes: 30,
  maxDurationMinutes: 120,
  maxActiveBookings: 2,
  advanceDays: 0,
  requiresApproval: false,
  feeMinor: 0,
  depositMinor: 0,
  bookingIntervalMinutes: 1,
  turnaroundMinutes: 0,
  allowExtensions: false,
  cancellationCutoffMinutes: 0,
};

export function AmenityForm({ amenity, onSave, busy }) {
  const formRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const [values, setValues] = useState(() => ({
    ...Object.fromEntries(
      Object.keys(defaults).map((key) => [
        key,
        amenity?.[key] ?? defaults[key],
      ]),
    ),
    feeMinor: String((amenity?.feeMinor ?? 0) / 100),
    depositMinor: String((amenity?.depositMinor ?? 0) / 100),
  }));
  useEffect(() => {
    if (submitAttempts)
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [submitAttempts]);
  const update = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const field = (key) => ({
    value: values[key],
    disabled: busy,
    error: errors[key],
    onChange: (event) => update(key, event.target.value),
  });
  const numberField = (key, label, max, hint) => (
    <Input
      label={label}
      type="number"
      min={key === "advanceDays" ? "0" : "1"}
      max={max}
      step="1"
      required
      hint={hint}
      {...field(key)}
    />
  );
  return (
    <form
      id="amenity-form"
      ref={formRef}
      className="amenity-form"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        const result = prepareAmenity(values);
        setErrors(result.errors);
        setSubmitAttempts((attempts) => attempts + 1);
        if (!Object.keys(result.errors).length) onSave(result.payload);
      }}
    >
      <p className="amenity-form__intro">
        Set up the facility, opening hours, and reservation rules. Required
        fields are marked *.
      </p>
      <fieldset className="amenity-form__section" disabled={busy}>
        <legend>Facility details</legend>
        <div className="amenity-form__grid">
          <Input
            label="Amenity name"
            placeholder="e.g. Community hall"
            required
            maxLength={100}
            {...field("name")}
          />
          <Select label="Availability" {...field("status")}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          <div className="amenity-form__wide">
            <Textarea
              label="Description"
              rows={2}
              maxLength={2000}
              placeholder="Location, facilities, or instructions for residents"
              {...field("description")}
            />
          </div>
        </div>
      </fieldset>
      <fieldset className="amenity-form__section" disabled={busy}>
        <legend>Opening schedule</legend>
        <Input
          label="Facility time zone"
          hint="Use an IANA time zone, such as Asia/Kolkata. All opening hours use this zone."
          required
          maxLength={100}
          {...field("timeZone")}
        />
        <fieldset
          className="amenity-form__days"
          tabIndex={-1}
          aria-invalid={errors.weekdays ? "true" : undefined}
          aria-describedby={errors.weekdays ? "amenity-days-error" : undefined}
        >
          <legend>
            Open days <span className="ui-field__required">*</span>
          </legend>
          <div className="amenity-form__weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (day, index) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={values.weekdays.includes(index)}
                    onChange={(event) =>
                      update(
                        "weekdays",
                        event.target.checked
                          ? [...values.weekdays, index].sort((a, b) => a - b)
                          : values.weekdays.filter((d) => d !== index),
                      )
                    }
                  />
                  <span>{day}</span>
                </label>
              ),
            )}
          </div>
          {errors.weekdays && (
            <p id="amenity-days-error" className="ui-field__error" role="alert">
              {errors.weekdays}
            </p>
          )}
        </fieldset>
        <div className="amenity-form__grid">
          <Input label="Opens at" type="time" required {...field("opensAt")} />
          <Input
            label="Closes at"
            type="time"
            required
            {...field("closesAt")}
          />
        </div>
        <p className="amenity-form__note">
          Opening and closing times must fall on the same day. Overnight hours
          are not supported.
        </p>
      </fieldset>
      <fieldset className="amenity-form__section" disabled={busy}>
        <legend>Reservation rules</legend>
        <div className="amenity-form__grid">
          {numberField("capacity", "Capacity (people)", 10000)}
          {numberField(
            "advanceDays",
            "Book at least (days before)",
            365,
            "Minimum notice before the start time. Use 0 for same-day bookings.",
          )}
          {numberField(
            "minDurationMinutes",
            "Minimum duration (minutes)",
            1440,
          )}
          {numberField(
            "maxDurationMinutes",
            "Maximum duration (minutes)",
            1440,
          )}
          {numberField(
            "maxActiveBookings",
            "Active bookings per resident",
            100,
            "Includes pending and approved reservations.",
          )}
          {numberField(
            "bookingIntervalMinutes",
            "Booking increment (minutes)",
            1440,
            "Start and end times align to increments from opening time.",
          )}
          <Input
            label="Turnaround / cleaning buffer (minutes)"
            type="number"
            min="0"
            max="1440"
            step="1"
            required
            hint="Required gap between reservations; 0 allows adjacent bookings."
            {...field("turnaroundMinutes")}
          />
          <Input
            label="Cancellation cutoff (minutes before start)"
            type="number"
            min="0"
            max="525600"
            step="1"
            required
            hint="0 allows cancellation until the reservation starts."
            {...field("cancellationCutoffMinutes")}
          />
        </div>
        <label className="amenity-form__choice">
          <input
            type="checkbox"
            checked={values.exclusive}
            onChange={(event) => update("exclusive", event.target.checked)}
          />
          <span>
            <strong>Reserve the entire facility</strong>
            <small>
              One reservation at a time. When off, overlapping reservations
              share the capacity.
            </small>
          </span>
        </label>
        <label className="amenity-form__choice">
          <input
            type="checkbox"
            checked={values.requiresApproval}
            onChange={(event) =>
              update("requiresApproval", event.target.checked)
            }
          />
          <span>
            <strong>Require Community Admin approval</strong>
            <small>
              When off, valid reservations are approved automatically.
            </small>
          </span>
        </label>
        <label className="amenity-form__choice">
          <input
            type="checkbox"
            checked={values.allowExtensions}
            onChange={(event) =>
              update("allowExtensions", event.target.checked)
            }
          />
          <span>
            <strong>Allow booking extensions</strong>
            <small>
              Residents can request a later end time before their approved
              booking ends. The same duration and approval rules apply.
            </small>
          </span>
        </label>
      </fieldset>
      <fieldset className="amenity-form__section" disabled={busy}>
        <legend>Fees &amp; deposit</legend>
        <div className="amenity-form__grid">
          <Input
            label="Flat booking fee (INR)"
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            required
            hint="Per reservation; enter 0 for free."
            {...field("feeMinor")}
          />
          <Input
            label="Refundable deposit (INR)"
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            required
            hint="Enter 0 if no deposit is needed."
            {...field("depositMinor")}
          />
        </div>
        <p className="amenity-form__note">
          Charges are recorded for tracking. Online payment collection is
          unavailable.
        </p>
      </fieldset>
      {amenity && (
        <p className="amenity-form__note">
          Availability rules cannot change while upcoming active reservations
          exist. Existing bookings retain their original charges.
        </p>
      )}
    </form>
  );
}
