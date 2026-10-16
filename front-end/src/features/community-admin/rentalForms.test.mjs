import test from "node:test";
import assert from "node:assert/strict";
import { tenantOnboardingPayload } from "./rentalForms.js";
const form = {
  listingId: "listing",
  mode: "EXISTING",
  existingTenantId: "resident",
  startDate: "2027-01-01",
  endDate: "2027-12-31",
  dueDay: "5",
  name: " Person ",
  email: " PERSON@EXAMPLE.COM ",
  password: "typed-password",
};
test("existing-account onboarding excludes account credentials and client-selected financial authority", () => {
  assert.deepEqual(
    tenantOnboardingPayload({
      ...form,
      monthlyRent: 1,
      payeeId: "attacker",
      status: "ACTIVE",
    }),
    {
      listingId: "listing",
      existingTenantId: "resident",
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      dueDay: 5,
    },
  );
});
test("new accounts use resident identity with pending tenancy and normalized email", () => {
  const payload = tenantOnboardingPayload({ ...form, mode: "NEW" });
  assert.equal(payload.existingTenantId, undefined);
  assert.deepEqual(payload.account, {
    name: "Person",
    email: "person@example.com",
    password: "typed-password",
    role: "RESIDENT",
    residentSituation: "TENANT_PENDING",
  });
});
test("invalid dates, due day and missing identities cannot produce onboarding payloads", () => {
  for (const change of [
    { endDate: form.startDate },
    { dueDay: "32" },
    { dueDay: "1.2" },
    { existingTenantId: "" },
    { mode: "NEW", password: "short" },
  ])
    assert.throws(() => tenantOnboardingPayload({ ...form, ...change }));
});
