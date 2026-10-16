export const phonePattern =
  /^(?=(?:\D*\d){7,15}\D*$)\+?(?:[0-9 ]|\(|\)|-){7,20}$/;
export const money = (minor) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minor / 100);
export const words = (value) =>
  String(value || "")
    .toLowerCase()
    .replaceAll("_", " ");
export function paymentMinor(value) {
  if (!/^\d+$/.test(value))
    throw new Error("Enter a positive whole INR amount.");
  const amount = Number(value) * 100;
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 2000000000)
    throw new Error("Enter a valid whole INR amount.");
  return amount;
}
export function applicationPayload(form, requestId, pricingVersion) {
  const result = Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ]),
  );
  for (const key of ["towers", "floors", "apartments"])
    result[key] = Number(result[key]);
  if (result.floors < result.towers || result.apartments < result.floors)
    throw new Error(
      "Total floors must cover all towers, and apartments must cover all floors.",
    );
  if (!result.phone) delete result.phone;
  return { ...result, requestId, pricingVersion };
}
