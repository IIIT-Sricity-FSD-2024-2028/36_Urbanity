// Keep editable inputs as strings; convert only when building the API DTO.
export function prepareAmenity(values) {
  const payload = {
    ...values,
    name: values.name.trim(),
    timeZone: values.timeZone.trim(),
  };
  const errors = {};
  if (!payload.name) errors.name = "Enter an amenity name.";
  try {
    if (!payload.timeZone) throw new Error();
    new Intl.DateTimeFormat("en", { timeZone: payload.timeZone }).format();
  } catch {
    errors.timeZone = "Enter a valid IANA time zone, such as Asia/Kolkata.";
  }
  if (!values.weekdays.length)
    errors.weekdays = "Select at least one open day.";
  const minutes = (time) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const validTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!validTime(values.opensAt)) errors.opensAt = "Choose an opening time.";
  if (!validTime(values.closesAt)) errors.closesAt = "Choose a closing time.";
  const openingMinutes = minutes(values.closesAt) - minutes(values.opensAt);
  if (!errors.opensAt && !errors.closesAt && openingMinutes <= 0) {
    errors.closesAt = "Closing time must follow opening time on the same day.";
  }
  for (const [key, max] of Object.entries({
    capacity: 10000,
    minDurationMinutes: 1440,
    maxDurationMinutes: 1440,
    maxActiveBookings: 100,
    advanceDays: 365,
    bookingIntervalMinutes: 1440,
    turnaroundMinutes: 1440,
    cancellationCutoffMinutes: 525600,
  })) {
    const min = [
      "advanceDays",
      "turnaroundMinutes",
      "cancellationCutoffMinutes",
    ].includes(key)
      ? 0
      : 1;
    const value = Number(values[key]);
    if (
      String(values[key]).trim() === "" ||
      !Number.isInteger(value) ||
      value < min ||
      value > max
    ) {
      errors[key] = `Enter a whole number from ${min} to ${max}.`;
    }
    payload[key] = value;
  }
  const shortest =
    Math.ceil(payload.minDurationMinutes / payload.bookingIntervalMinutes) *
    payload.bookingIntervalMinutes;
  if (
    !errors.bookingIntervalMinutes &&
    (shortest > payload.maxDurationMinutes || shortest > openingMinutes)
  )
    errors.bookingIntervalMinutes =
      "The increment must allow a duration within the limits and opening hours.";
  if (
    !errors.minDurationMinutes &&
    !errors.maxDurationMinutes &&
    payload.minDurationMinutes > payload.maxDurationMinutes
  ) {
    errors.maxDurationMinutes =
      "Maximum duration must be at least the minimum duration.";
  }
  if (
    !errors.minDurationMinutes &&
    !errors.opensAt &&
    !errors.closesAt &&
    payload.minDurationMinutes > openingMinutes
  ) {
    errors.minDurationMinutes =
      "Minimum duration must fit within the opening hours.";
  }
  for (const key of ["feeMinor", "depositMinor"]) {
    const text = String(values[key]);
    const [whole, fraction = ""] = text.split(".");
    const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    if (
      !/^\d+(\.\d{1,2})?$/.test(text) ||
      !Number.isSafeInteger(paise) ||
      paise < 0 ||
      paise > 100000000
    ) {
      errors[key] =
        "Enter an amount from ₹0 to ₹10,00,000 with up to two decimal places.";
    }
    payload[key] = paise;
  }
  return { payload, errors };
}
