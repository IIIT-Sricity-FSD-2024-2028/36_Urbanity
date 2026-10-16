// Presentation data stays separate from server-side authorization.
export const RENTAL_SECTIONS = Object.freeze([
  ["overview", "Overview"],
  ["listings", "Rental Listings"],
  ["leases", "Tenants & Leases"],
  ["rent", "Rent Tracking"],
]);
export function createRentalView(data, apartments = data.apartments || []) {
  const communityListings = data.listings.filter(
    (item) => item.arrangement === "COMMUNITY",
  );
  const communityLeases = data.leases.filter(
    (item) => item.arrangement === "COMMUNITY",
  );
  const withLease = (lease, item) => ({
    ...item,
    tenant: lease.tenant?.name,
    apartmentId: lease.apartmentId,
    leaseId: lease.id,
  });
  return {
    communityListings,
    communityLeases,
    legacyLeases: data.leases.filter((item) => item.arrangement === "OWNER"),
    legacyListings: data.listings.filter(
      (item) => item.arrangement === "OWNER",
    ),
    eligibleApartments: apartments.filter(
      (item) =>
        data.inventory.some(
          (record) =>
            record.id === item.id &&
            record.occupancy === "VACANT" &&
            !record.ownerUserId,
        ) &&
        !data.listings.some(
          (listing) =>
            listing.apartmentId === item.id &&
            [
              "DRAFT",
              "AVAILABLE",
              "RESERVED",
              "RENTED",
              "PENDING_ADMIN_APPROVAL",
            ].includes(listing.status),
        ),
    ),
    obligations: communityLeases.flatMap((lease) =>
      (lease.obligations || []).map((item) => withLease(lease, item)),
    ),
    payments: communityLeases.flatMap((lease) =>
      (lease.payments || []).map((item) => withLease(lease, item)),
    ),
  };
}
