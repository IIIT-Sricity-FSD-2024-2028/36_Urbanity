import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationPayload,
  money,
  paymentMinor,
  phonePattern,
} from "./registrationModel.mjs";
import { registrationContact } from "../super-admin/utils/registrationContact.mjs";

test("payment evidence preserves whole INR and rejects ambiguous or fractional input", () => {
  assert.equal(paymentMinor("25000"), 2500000);
  for (const value of [
    "",
    "-10",
    "0",
    "12.5",
    "1e3",
    "1,000",
    "Infinity",
    "20000001",
  ])
    assert.throws(() => paymentMinor(value));
});
test("registration payload normalizes proposed totals, keeps identity and pricing version, omits blank phone", () => {
  const result = applicationPayload(
    {
      fullName: " Person ",
      email: " person@example.test ",
      phone: " ",
      towers: "2",
      floors: "6",
      apartments: "24",
      authorized: true,
    },
    "request-id",
    7,
  );
  assert.deepEqual(result, {
    fullName: "Person",
    email: "person@example.test",
    towers: 2,
    floors: 6,
    apartments: 24,
    authorized: true,
    requestId: "request-id",
    pricingVersion: 7,
  });
});
test("proposed size rejects inconsistent hierarchy before requesting a quote", () => {
  assert.throws(() =>
    applicationPayload({ towers: "2", floors: "1", apartments: "20" }, "id", 1),
  );
  assert.throws(() =>
    applicationPayload({ towers: "2", floors: "8", apartments: "4" }, "id", 1),
  );
});
test("INR display shows the credited total in rupees", () => {
  assert.match(money(230000), /2,300/);
  assert.match(money(0), /0/);
});
test("contact link encodes addresses and cannot inject extra mail headers", () => {
  const address = "person+urbanity@example.test?bcc=other@example.test";
  const link = registrationContact(address);
  assert.ok(link.startsWith(`mailto:${encodeURIComponent(address)}?subject=`));
  assert.equal(link.split("?subject=").length, 2);
  assert.ok(!link.includes("&bcc="));
  assert.ok(!link.includes("password"));
});

test("optional phone validates actual digits and common formatting", () => {
  assert.equal(phonePattern.test("+91 (98765) 43210"), true);
  assert.equal(phonePattern.test("-------"), false);
  assert.equal(phonePattern.test("letters"), false);
});
