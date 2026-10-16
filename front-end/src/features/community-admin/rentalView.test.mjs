import test from "node:test";
import assert from "node:assert/strict";
import { createRentalView, RENTAL_SECTIONS } from "./rentalView.js";
import { NAVIGATION_BY_ROLE } from "../../constants/navigation.js";
import { ROLES } from "../../constants/roles.js";

test("community rental screens exclude private money while preserving archived records", () => {
  const privateLease = {
    id: "old",
    arrangement: "OWNER",
    obligations: [{ id: "private-bill", amountDue: 100 }],
    payments: [{ id: "private-payment", amount: 100 }],
  };
  const data = {
    apartments: [],
    inventory: [],
    listings: [
      { id: "private", arrangement: "OWNER" },
      { id: "community", arrangement: "COMMUNITY" },
    ],
    leases: [
      privateLease,
      {
        id: "lease",
        arrangement: "COMMUNITY",
        tenant: { name: "Tenant" },
        apartmentId: "unit",
        obligations: [{ id: "bill", amountDue: 8000, status: "PENDING" }],
        payments: [
          { id: "evidence", amount: 500, status: "PENDING_VERIFICATION" },
        ],
        deposit: { collected: 1000 },
      },
    ],
  };
  const result = createRentalView(data);
  assert.deepEqual(
    result.communityListings.map((item) => item.id),
    ["community"],
  );
  assert.deepEqual(result.legacyLeases, [privateLease]);
  assert.deepEqual(
    result.obligations.map((item) => item.id),
    ["bill"],
  );
  assert.equal(result.obligations[0].leaseId, "lease");
  assert.equal(result.payments[0].status, "PENDING_VERIFICATION");
  assert.equal(result.payments.length, 1); // deposit and private payments are separate
});
test("listing choices exclude owners, occupied units, ambiguous legacy occupancy and existing reservations", () => {
  const ids = ["free", "owned", "occupied", "review", "draft", "legacy"];
  const data = {
    apartments: ids.map((id) => ({ id })),
    inventory: ids.map((id) => ({
      id,
      occupancy:
        id === "occupied"
          ? "COMMUNITY_TENANT"
          : id === "review"
            ? "REVIEW_REQUIRED"
            : "VACANT",
      ownerUserId: id === "owned" ? "owner" : null,
    })),
    listings: [
      {
        id: "listing",
        apartmentId: "draft",
        arrangement: "COMMUNITY",
        status: "DRAFT",
      },
      {
        id: "old-listing",
        apartmentId: "legacy",
        arrangement: "OWNER",
        status: "PENDING_ADMIN_APPROVAL",
      },
    ],
    leases: [],
  };
  assert.deepEqual(
    createRentalView(data).eligibleApartments.map((item) => item.id),
    ["free"],
  );
});
test("empty rentals produce empty records and four distinct sections", () => {
  const result = createRentalView({
    apartments: [],
    inventory: [],
    listings: [],
    leases: [],
  });
  assert.deepEqual(result.obligations, []);
  assert.deepEqual(result.payments, []);
  assert.equal(RENTAL_SECTIONS.length, 4);
  assert.equal(new Set(RENTAL_SECTIONS.map(([id]) => id)).size, 4);
});
test("Community Admin navigation exposes exactly one Rentals entry", () => {
  const items = NAVIGATION_BY_ROLE[ROLES.COMMUNITY_ADMIN].items;
  assert.deepEqual(
    items
      .filter((item) => /rent|lease|tenant|ownership/i.test(item.label))
      .map((item) => item.label),
    ["Rentals"],
  );
});
