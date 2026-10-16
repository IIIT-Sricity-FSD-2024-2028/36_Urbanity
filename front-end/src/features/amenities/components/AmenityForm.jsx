import { useState } from "react";
import {
  Button,
  Input,
  Select,
  Textarea,
} from "../../../components/ui/index.js";
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
  advanceDays: 30,
  requiresApproval: false,
  feeMinor: 0,
  depositMinor: 0,
};
export function AmenityForm({ amenity, onSave, busy }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      Object.keys(defaults).map((k) => [k, amenity?.[k] ?? defaults[k]]),
    ),
  );
  const field = (key) => ({
    value: values[key],
    disabled: busy,
    onChange: (e) =>
      setValues((v) => ({
        ...v,
        [key]:
          typeof defaults[key] === "number"
            ? Number(e.target.value)
            : e.target.value,
      })),
  });
  return (
    <form
      className="amenity-stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(values);
      }}
    >
      <Input label="Name" required maxLength={100} {...field("name")} />
      <Textarea
        label="Description"
        maxLength={2000}
        {...field("description")}
      />
      <div className="amenity-grid">
        <Select label="Availability" {...field("status")}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
        <Input
          label="Facility time zone"
          hint="IANA name, for example Asia/Kolkata"
          required
          {...field("timeZone")}
        />
        <Input label="Opens at" type="time" required {...field("opensAt")} />
        <Input label="Closes at" type="time" required {...field("closesAt")} />
        {[
          ["capacity", "Capacity (people)", 10000],
          ["minDurationMinutes", "Minimum duration (minutes)", 1440],
          ["maxDurationMinutes", "Maximum duration (minutes)", 1440],
          ["maxActiveBookings", "Active bookings per resident", 100],
          ["advanceDays", "Book ahead (days)", 365],
          ["feeMinor", "Flat fee (paise)", 100000000],
          ["depositMinor", "Deposit (paise)", 100000000],
        ].map(([key, label, max]) => (
          <Input
            key={key}
            label={label}
            type="number"
            min={key.endsWith("Minor") ? 0 : 1}
            max={max}
            step="1"
            required
            {...field(key)}
          />
        ))}
      </div>
      <fieldset disabled={busy}>
        <legend>Open days</legend>
        <div className="amenity-actions">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={values.weekdays.includes(i)}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    weekdays: e.target.checked
                      ? [...v.weekdays, i].sort()
                      : v.weekdays.filter((d) => d !== i),
                  }))
                }
              />{" "}
              {day}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <input
          type="checkbox"
          disabled={busy}
          checked={values.exclusive}
          onChange={(e) =>
            setValues((v) => ({ ...v, exclusive: e.target.checked }))
          }
        />{" "}
        Reserve entire facility (otherwise capacity is shared)
      </label>
      <label>
        <input
          type="checkbox"
          disabled={busy}
          checked={values.requiresApproval}
          onChange={(e) =>
            setValues((v) => ({ ...v, requiresApproval: e.target.checked }))
          }
        />{" "}
        Require Community Admin approval
      </label>
      <p>
        Amounts are in paise (100 paise = ₹1). Availability rule changes require
        no upcoming active reservations. Existing bookings retain their original
        charges.
      </p>
      <Button type="submit" loading={busy}>
        Save amenity
      </Button>
    </form>
  );
}
