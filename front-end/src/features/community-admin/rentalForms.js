export function tenantOnboardingPayload(form) {
  if (
    !form.listingId ||
    !form.startDate ||
    !form.endDate ||
    form.startDate >= form.endDate
  )
    throw new Error("Select a listing and lease dates with end after start.");
  const dueDay = Number(form.dueDay);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
    throw new Error("Due day must be from 1 to 31.");
  const payload = {
    listingId: form.listingId,
    startDate: form.startDate,
    endDate: form.endDate,
    dueDay,
  };
  if (form.mode === "EXISTING") {
    if (!form.existingTenantId) throw new Error("Select an existing resident.");
    return { ...payload, existingTenantId: form.existingTenantId };
  }
  if (
    form.mode !== "NEW" ||
    !form.name.trim() ||
    !form.email.trim() ||
    form.password.length < 8
  )
    throw new Error(
      "Enter the resident's name, email and a password of at least eight characters.",
    );
  return {
    ...payload,
    account: {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: "RESIDENT",
      residentSituation: "TENANT_PENDING",
    },
  };
}
