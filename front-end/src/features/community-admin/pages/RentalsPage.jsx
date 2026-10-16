import { createRentalView, RENTAL_SECTIONS } from "../rentalView.js";
import { RentalOnboarding } from "../components/RentalOnboarding.jsx";
import { useCallback, useMemo, useState } from "react";
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Select,
  Textarea,
  useToast,
} from "../../../components/ui/index.js";
import {
  DataTable,
  MetricCard,
  PageHeader,
} from "../../../components/data-display/index.js";
import { useCommunityResource } from "../hooks/useCommunityResource.js";
import { communityAdminService } from "../services/communityAdminService.js";

const money = (value) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
  }).format(Number(value || 0));
const date = (value) => {
  if (!value) return "Not available";
  const dateOnlyValue =
    /^\d{4}-\d{2}-\d{2}$/.test(value) || /T23:59:59\.999Z$/.test(value)
      ? value.slice(0, 10)
      : null;
  const parsed = dateOnlyValue
    ? new Date(`${dateOnlyValue}T12:00:00`)
    : new Date(value);
  return parsed.toLocaleDateString();
};
const apartmentText = (item, data) => {
  const apartmentId = item.apartmentId ?? item.id;
  const apartment = data.apartments.find((a) => a.id === apartmentId);
  const floor = data.floors.find((f) => f.id === apartment?.floorId);
  const tower = data.towers.find((t) => t.id === floor?.towerId);
  return (
    [
      tower?.name,
      floor?.label || (floor ? `Floor ${floor.floorNumber}` : ""),
      apartment?.apartmentNumber || apartment?.label,
    ]
      .filter(Boolean)
      .join(" · ") ||
    apartmentId ||
    "Apartment unavailable"
  );
};

export function RentalsPage() {
  const { showToast } = useToast();
  const loader = useCallback(async () => {
    const [listings, leases, apartments, floors, towers, inventory, users] =
      await Promise.all([
        communityAdminService.listRentalListings(),
        communityAdminService.listRentalLeases(),
        communityAdminService.listApartments(),
        communityAdminService.listFloors(),
        communityAdminService.listTowers(),
        communityAdminService.rentalInventory(),
        communityAdminService.listUsers(),
      ]);
    return { listings, leases, apartments, floors, towers, inventory, users };
  }, []);
  const { data, loading, error, reload } = useCommunityResource(loader);
  const [listingForm, setListingForm] = useState({
    apartmentId: "",
    monthlyRent: "",
    securityDeposit: "",
    availableFrom: "",
    details: "",
  });
  const [adjustment, setAdjustment] = useState({
    leaseId: "",
    type: "DEDUCTION",
    amount: "",
    reason: "",
    transactionReference: "",
  });
  const [rentRefund, setRentRefund] = useState({
    paymentId: "",
    amount: "",
    reason: "",
    transactionReference: "",
  });
  const [amendment, setAmendment] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [review, setReview] = useState(null);
  const [section, setSection] = useState("overview");
  const [creatingListing, setCreatingListing] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [selectedLease, setSelectedLease] = useState(null);
  const availableListings = useMemo(
    () =>
      (data?.listings || []).filter(
        (item) =>
          item.arrangement === "COMMUNITY" && item.status === "AVAILABLE",
      ),
    [data],
  );
  const apartments = useMemo(() => {
    if (!data) return [];
    return data.apartments.map((item) => ({
      ...item,
      label: apartmentText(item, data),
    }));
  }, [data]);

  const act = async (operation, message) => {
    setSaving(true);
    try {
      await operation();
      showToast({ type: "success", message });
      await reload();
      return true;
    } catch (requestError) {
      showToast({
        type: "error",
        message: requestError.message || "Rental operation failed.",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };
  const createListing = async (event) => {
    event.preventDefault();
    const saved = await act(
      () =>
        communityAdminService.createRentalListing({
          apartmentId: listingForm.apartmentId,
          arrangement: "COMMUNITY",
          monthlyRent: Number(listingForm.monthlyRent),
          securityDeposit: Number(listingForm.securityDeposit),
          availableFrom: listingForm.availableFrom,
          details: listingForm.details,
        }),
      "Draft rental listing created.",
    );
    if (!saved) return;
    setCreatingListing(false);
    setListingForm({
      apartmentId: "",
      monthlyRent: "",
      securityDeposit: "",
      availableFrom: "",
      details: "",
    });
  };
  const saveListing = async (event) => {
    event.preventDefault();
    const saved = await act(
      () =>
        communityAdminService.updateRentalListing(editing.id, {
          monthlyRent: Number(editing.monthlyRent),
          securityDeposit: Number(editing.securityDeposit),
          availableFrom: editing.availableFrom,
          details: editing.details,
        }),
      "Rental listing updated.",
    );
    if (saved) setEditing(null);
  };
  const submitAdjustment = (event) => {
    event.preventDefault();
    const payload = {
      amount: Number(adjustment.amount),
      reason: adjustment.reason,
      ...(adjustment.type === "REFUND"
        ? { transactionReference: adjustment.transactionReference }
        : {}),
    };
    act(
      () =>
        adjustment.type === "REFUND"
          ? communityAdminService.createDepositRefund(
              adjustment.leaseId,
              payload,
            )
          : communityAdminService.createDepositDeduction(
              adjustment.leaseId,
              payload,
            ),
      adjustment.type === "REFUND"
        ? "Refund recorded for tenant confirmation."
        : "Deposit deduction recorded.",
    );
    setAdjustment((current) => ({
      ...current,
      amount: "",
      reason: "",
      transactionReference: "",
    }));
  };
  const submitRentRefund = (event) => {
    event.preventDefault();
    act(
      () =>
        communityAdminService.recordRentalRefund(rentRefund.paymentId, {
          amount: Number(rentRefund.amount),
          reason: rentRefund.reason,
          transactionReference: rentRefund.transactionReference,
        }),
      "Rent refund recorded for tenant confirmation.",
    );
    setRentRefund({
      paymentId: "",
      amount: "",
      reason: "",
      transactionReference: "",
    });
  };
  const submitAmendment = (event) => {
    event.preventDefault();
    const { leaseId, monthlyRent, effectiveDate, reason } = amendment;
    act(
      () =>
        communityAdminService.proposeRentAmendment(leaseId, {
          monthlyRent: Number(monthlyRent),
          effectiveDate,
          reason,
        }),
      "Amendment sent to the tenant for a decision.",
    );
    setAmendment(null);
  };
  const submitResolution = (event) => {
    event.preventDefault();
    act(
      () =>
        communityAdminService.resolveDepositDispute(
          resolution.entryId,
          resolution.decision,
          resolution.reason,
        ),
      `Disputed deduction ${resolution.decision.toLowerCase()}.`,
    );
    setResolution(null);
  };

  const listingColumns = useMemo(
    () => [
      {
        key: "apartmentId",
        header: "Apartment",
        render: (_, row) => apartmentText(row, data),
      },
      { key: "monthlyRent", header: "Monthly rent", render: money },
      { key: "securityDeposit", header: "Deposit", render: money },
      { key: "availableFrom", header: "Available", render: date },
      { key: "status", header: "Status" },
      {
        key: "actions",
        header: "Actions",
        render: (_, row) => (
          <div className="ca-actions">
            {["DRAFT", "AVAILABLE"].includes(row.status) && (
              <Button
                variant="secondary"
                onClick={() => setEditing({ ...row })}
              >
                Edit
              </Button>
            )}
            {row.status === "DRAFT" && (
              <Button
                onClick={() =>
                  act(
                    () =>
                      communityAdminService.updateRentalListing(row.id, {
                        status: "AVAILABLE",
                      }),
                    "Listing published.",
                  )
                }
              >
                Publish
              </Button>
            )}
            {row.status === "AVAILABLE" && (
              <Button
                variant="secondary"
                onClick={() =>
                  act(
                    () =>
                      communityAdminService.updateRentalListing(row.id, {
                        status: "WITHDRAWN",
                      }),
                    "Listing withdrawn.",
                  )
                }
              >
                Withdraw
              </Button>
            )}
          </div>
        ),
      },
    ],
    [data],
  );
  const leaseColumns = useMemo(
    () => [
      {
        key: "apartmentId",
        header: "Apartment",
        render: (_, row) => apartmentText(row, data),
      },
      {
        key: "tenant",
        header: "Tenant",
        render: (value) => value?.name || "Unknown",
      },
      { key: "monthlyRent", header: "Rent", render: money },
      { key: "startDate", header: "Start", render: date },
      { key: "endDate", header: "End", render: date },
      { key: "status", header: "Status" },
      {
        key: "actions",
        header: "Actions",
        render: (_, row) => (
          <Button variant="secondary" onClick={() => setSelectedLease(row.id)}>
            View & manage
          </Button>
        ),
      },
    ],
    [data],
  );
  if (loading) return <LoadingState message="Loading rental management..." />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const {
    communityListings,
    communityLeases,
    legacyLeases,
    legacyListings,
    eligibleApartments,
    obligations,
    payments,
  } = createRentalView(data, apartments);
  return (
    <div className="ca-stack ca-rentals">
      <PageHeader
        eyebrow="Property operations"
        title="Rentals"
        description="Community rental listings, tenants, leases, and rent records."
      />
      <nav
        className="ca-actions ca-rentals__sections"
        aria-label="Rental sections"
      >
        {RENTAL_SECTIONS.map(([key, label]) => (
          <Button
            key={key}
            variant={section === key ? "primary" : "secondary"}
            aria-pressed={section === key}
            onClick={() => setSection(key)}
          >
            {label}
          </Button>
        ))}
      </nav>
      {section === "overview" && (
        <>
          <div className="ca-metrics">
            <MetricCard
              label="Available for Rent"
              value={
                communityListings.filter(
                  (item) =>
                    item.arrangement === "COMMUNITY" &&
                    item.status === "AVAILABLE",
                ).length
              }
            />
            <MetricCard
              label="Active Leases"
              value={
                communityLeases.filter((item) => item.status === "ACTIVE")
                  .length
              }
            />
            <MetricCard
              label="Occupied Apartments"
              value={
                data.inventory.filter((item) =>
                  [
                    "OWNER_OCCUPIED",
                    "COMMUNITY_TENANT",
                    "PRIVATE_TENANT",
                  ].includes(item.occupancy),
                ).length
              }
            />
            <MetricCard
              label="Pending Rent Obligations"
              value={
                obligations.filter((item) => item.amountPaid < item.amountDue)
                  .length
              }
            />
          </div>
          <Card title="Get started">
            <div className="ca-actions">
              <Button onClick={() => setCreatingListing(true)}>
                Create Rental Listing
              </Button>
              <Button
                variant="secondary"
                disabled={!availableListings.length}
                onClick={() => setOnboarding(true)}
              >
                Onboard Tenant
              </Button>
              <Button variant="secondary" onClick={() => setSection("rent")}>
                Track Rent
              </Button>
            </div>
          </Card>
          <Card title="Apartment inventory" flush>
            <DataTable
              rows={data.inventory}
              columns={[
                {
                  key: "apartmentNumber",
                  header: "Apartment",
                  render: (_, row) => apartmentText(row, data),
                },
                {
                  key: "ownerUserId",
                  header: "Owner",
                  render: (value) =>
                    data.users.find((user) => user.id === value)?.name ||
                    value ||
                    "Community-managed / unassigned",
                },
                {
                  key: "occupancy",
                  header: "Occupancy",
                  render: (value) => value.replaceAll("_", " "),
                },
              ]}
              emptyTitle="No apartments"
            />
          </Card>
          {(legacyLeases.length > 0 || legacyListings.length > 0) && (
            <Card title="Historical private rentals">
              <p className="ca-muted">
                Archived records only. Private rentals are managed outside
                Urbanity.
              </p>
              <DataTable
                rows={legacyLeases}
                columns={leaseColumns.filter(
                  (column) => column.key !== "actions",
                )}
                emptyTitle="No historical leases"
              />
              {legacyLeases.map((lease) => (
                <details key={lease.id}>
                  <summary>
                    {apartmentText(lease, data)} &middot; Financial history
                  </summary>
                  <DataTable
                    rows={lease.obligations || []}
                    columns={[
                      { key: "billingPeriod", header: "Period" },
                      { key: "amountDue", header: "Rent due", render: money },
                      { key: "status", header: "Status" },
                    ]}
                    emptyTitle="No obligations"
                  />
                  <DataTable
                    rows={lease.payments || []}
                    columns={[
                      { key: "transactionReference", header: "Reference" },
                      { key: "amount", header: "Payment", render: money },
                      { key: "status", header: "Status" },
                    ]}
                    emptyTitle="No payment history"
                  />
                  <p>
                    Deposit collected: {money(lease.deposit?.collected)}{" "}
                    &middot; Refunded: {money(lease.deposit?.refunded)}
                  </p>
                  <DataTable
                    rows={lease.refunds || []}
                    columns={[
                      {
                        key: "transactionReference",
                        header: "Rent refund reference",
                      },
                      { key: "amount", header: "Amount", render: money },
                      { key: "status", header: "Status" },
                    ]}
                    emptyTitle="No rent refund history"
                  />
                  <DataTable
                    rows={lease.deposit?.history || []}
                    columns={[
                      { key: "type", header: "Deposit entry" },
                      { key: "amount", header: "Amount", render: money },
                      { key: "status", header: "Status" },
                    ]}
                    emptyTitle="No deposit history"
                  />
                </details>
              ))}
              <DataTable
                rows={legacyListings}
                columns={listingColumns.filter(
                  (column) => column.key !== "actions",
                )}
                emptyTitle="No historical listings"
              />
            </Card>
          )}
        </>
      )}
      {section === "listings" && (
        <Card
          title="Rental Listings"
          actions={
            <Button onClick={() => setCreatingListing(true)}>
              Create Rental Listing
            </Button>
          }
          flush
        >
          <DataTable
            rows={communityListings}
            columns={listingColumns}
            emptyTitle="No rental listings"
            emptyMessage="Create a listing for an eligible community apartment."
          />
        </Card>
      )}
      {section === "leases" && (
        <Card
          title="Tenants & Leases"
          actions={
            <Button
              disabled={!availableListings.length}
              onClick={() => setOnboarding(true)}
            >
              Onboard Tenant
            </Button>
          }
          flush
        >
          <DataTable
            rows={communityLeases}
            columns={leaseColumns}
            emptyTitle="No leases"
            emptyMessage="Publish a listing, then onboard a tenant."
          />
        </Card>
      )}
      {section === "rent" && (
        <>
          <Card title="Rent obligations" flush>
            <DataTable
              rows={obligations}
              columns={[
                { key: "tenant", header: "Tenant" },
                {
                  key: "apartmentId",
                  header: "Apartment",
                  render: (_, row) => apartmentText(row, data),
                },
                { key: "billingPeriod", header: "Billing Period" },
                { key: "amountDue", header: "Amount Due", render: money },
                { key: "dueDate", header: "Due Date", render: date },
                { key: "status", header: "Payment Status" },
                {
                  key: "actions",
                  header: "Actions",
                  render: (_, row) => (
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedLease(row.leaseId)}
                    >
                      View lease
                    </Button>
                  ),
                },
              ]}
              emptyTitle="No rent obligations"
              emptyMessage="Rent appears after an accepted lease is activated and begins."
            />
          </Card>
          <Card title="Rent payments" flush>
            <DataTable
              rows={payments}
              columns={[
                { key: "tenant", header: "Tenant" },
                {
                  key: "apartmentId",
                  header: "Apartment",
                  render: (_, row) => apartmentText(row, data),
                },
                { key: "transactionReference", header: "Reference" },
                { key: "amount", header: "Amount", render: money },
                { key: "status", header: "Status" },
                {
                  key: "actions",
                  header: "Actions",
                  render: (_, row) => (
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedLease(row.leaseId)}
                    >
                      Review in lease
                    </Button>
                  ),
                },
              ]}
              emptyTitle="No rent payments"
              emptyMessage="Payment evidence remains pending until verified. Deposits are separate in lease details."
            />
          </Card>
        </>
      )}
      <Modal
        isOpen={creatingListing}
        onClose={saving ? undefined : () => setCreatingListing(false)}
        title="Create Rental Listing"
      >
        <form className="ca-form ca-form--grid" onSubmit={createListing}>
          <Select
            label="Apartment"
            hint={
              eligibleApartments.length
                ? "Vacant community apartments only."
                : "No eligible apartments. Check ownership, occupancy, and existing listings."
            }
            required
            value={listingForm.apartmentId}
            onChange={(event) =>
              setListingForm({
                ...listingForm,
                apartmentId: event.target.value,
              })
            }
          >
            <option value="">Choose an apartment</option>
            {eligibleApartments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
          <Input
            label="Monthly rent"
            type="number"
            min="0"
            step="0.01"
            required
            value={listingForm.monthlyRent}
            onChange={(event) =>
              setListingForm({
                ...listingForm,
                monthlyRent: event.target.value,
              })
            }
          />
          <Input
            label="Security deposit"
            type="number"
            min="0"
            step="0.01"
            required
            value={listingForm.securityDeposit}
            onChange={(event) =>
              setListingForm({
                ...listingForm,
                securityDeposit: event.target.value,
              })
            }
          />
          <Input
            label="Available from"
            type="date"
            required
            value={listingForm.availableFrom}
            onChange={(event) =>
              setListingForm({
                ...listingForm,
                availableFrom: event.target.value,
              })
            }
          />
          <div className="ca-rentals__wide">
            <Textarea
              label="Rental details"
              rows="3"
              value={listingForm.details}
              onChange={(event) =>
                setListingForm({ ...listingForm, details: event.target.value })
              }
            />
          </div>
          <div className="ca-actions ca-rentals__wide">
            <Button
              type="submit"
              loading={saving}
              disabled={!eligibleApartments.length}
            >
              Create listing
            </Button>
          </div>
        </form>
      </Modal>
      {editing && (
        <Modal
          isOpen
          onClose={saving ? undefined : () => setEditing(null)}
          title={`Edit listing · ${apartmentText(editing, data)}`}
        >
          <form className="ca-form" onSubmit={saveListing}>
            <Input
              label="Monthly rent"
              type="number"
              min="0"
              step="0.01"
              required
              value={editing.monthlyRent}
              onChange={(event) =>
                setEditing({ ...editing, monthlyRent: event.target.value })
              }
            />
            <Input
              label="Security deposit"
              type="number"
              min="0"
              step="0.01"
              required
              value={editing.securityDeposit}
              onChange={(event) =>
                setEditing({ ...editing, securityDeposit: event.target.value })
              }
            />
            <Input
              label="Available from"
              type="date"
              required
              value={String(editing.availableFrom).slice(0, 10)}
              onChange={(event) =>
                setEditing({ ...editing, availableFrom: event.target.value })
              }
            />
            <Textarea
              label="Rental details"
              rows="3"
              value={editing.details || ""}
              onChange={(event) =>
                setEditing({ ...editing, details: event.target.value })
              }
            />
            <div className="ca-actions">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save listing
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <Modal
        isOpen={onboarding}
        title="Onboard Tenant"
        size="lg"
        onClose={() => setOnboarding(false)}
      >
        {onboarding && (
          <RentalOnboarding
            apartments={apartments}
            listings={communityListings}
            residents={data.users.filter((user) => user.role === "RESIDENT")}
            onSaved={async () => {
              setOnboarding(false);
              setSection("leases");
              await reload();
            }}
          />
        )}
      </Modal>
      {communityLeases
        .filter((lease) => lease.id === selectedLease)
        .map((lease) => (
          <Modal
            isOpen
            size="lg"
            onClose={
              saving
                ? undefined
                : () => {
                    setSelectedLease(null);
                    setAmendment(null);
                    setResolution(null);
                  }
            }
            key={lease.id}
            title={`${apartmentText(lease, data)} · ${lease.tenant?.name || "Tenant"}`}
          >
            {lease.requiresReview && (
              <ErrorState
                title="Manual reconciliation required"
                message="This lease is missing approval or rent recipient information. Reconcile the original records before granting occupancy or generating new charges."
              />
            )}
            <p className="ca-muted">
              {lease.status} · Current monthly rent{" "}
              {money(lease.currentMonthlyRent ?? lease.monthlyRent)} · Due day{" "}
              {lease.dueDay} · Lease expiry {date(lease.endDate)}
              {lease.reminders?.leaseExpiry
                ? " · Expiry reminder due soon"
                : ""}
            </p>
            {lease.nextRentIncrease && (
              <p className="ca-muted">
                Scheduled rent: {money(lease.nextRentIncrease.amount)} from{" "}
                {date(lease.nextRentIncrease.date)}.
              </p>
            )}
            {lease.status === "ACTIVE" && (
              <Button
                variant="secondary"
                onClick={() =>
                  setAmendment({
                    leaseId: lease.id,
                    monthlyRent: lease.currentMonthlyRent ?? lease.monthlyRent,
                    effectiveDate: "",
                    reason: "",
                  })
                }
              >
                Propose rent amendment
              </Button>
            )}
            {amendment?.leaseId === lease.id && (
              <form className="ca-form" onSubmit={submitAmendment}>
                <Input
                  label="Proposed monthly rent"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={amendment.monthlyRent}
                  onChange={(event) =>
                    setAmendment({
                      ...amendment,
                      monthlyRent: event.target.value,
                    })
                  }
                />
                <Input
                  label="Effective first day of month"
                  type="date"
                  required
                  value={amendment.effectiveDate}
                  onChange={(event) =>
                    setAmendment({
                      ...amendment,
                      effectiveDate: event.target.value,
                    })
                  }
                />
                <Input
                  label="Reason"
                  required
                  value={amendment.reason}
                  onChange={(event) =>
                    setAmendment({ ...amendment, reason: event.target.value })
                  }
                />
                <Button type="submit" loading={saving}>
                  Send for tenant decision
                </Button>
                <Button variant="secondary" onClick={() => setAmendment(null)}>
                  Cancel
                </Button>
              </form>
            )}
            <DataTable
              rows={lease.amendments || []}
              columns={[
                {
                  key: "effectiveDate",
                  header: "Amendment effective",
                  render: date,
                },
                { key: "reason", header: "Reason" },
                {
                  key: "terms",
                  header: "Terms",
                  render: (terms) =>
                    terms.monthlyRent === undefined
                      ? "Other lease terms"
                      : `${money(terms.monthlyRent)} monthly rent`,
                },
                { key: "status", header: "Tenant decision" },
                {
                  key: "actions",
                  header: "Action",
                  render: (_, item) =>
                    item.status === "PENDING_TENANT_ACCEPTANCE" ? (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          act(
                            () =>
                              communityAdminService.withdrawRentAmendment(
                                item.id,
                              ),
                            "Pending amendment withdrawn.",
                          )
                        }
                      >
                        Withdraw
                      </Button>
                    ) : (
                      "—"
                    ),
                },
              ]}
              emptyTitle="No rent amendments"
            />
            {lease.status === "PENDING_APPROVAL" && (
              <Button
                disabled={!lease.tenantAccepted}
                onClick={() =>
                  act(
                    () => communityAdminService.activateRentalLease(lease.id),
                    "Lease activated.",
                  )
                }
              >
                {lease.tenantAccepted
                  ? "Activate accepted lease"
                  : "Waiting for tenant acceptance"}
              </Button>
            )}
            {!!lease.reminders?.upcomingRent?.length && (
              <p className="ca-muted">
                Rent due within seven days:{" "}
                {lease.reminders.upcomingRent
                  .map(
                    (item) =>
                      `${date(item.dueDate)} (${money(item.outstandingBalance)})`,
                  )
                  .join(", ")}
              </p>
            )}
            {!!lease.reminders?.overdueRent?.length && (
              <p className="ca-muted">
                Overdue rent obligations: {lease.reminders.overdueRent.length}
              </p>
            )}
            <DataTable
              rows={lease.obligations || []}
              columns={[
                { key: "billingPeriod", header: "Period" },
                { key: "dueDate", header: "Due", render: date },
                { key: "amountDue", header: "Amount", render: money },
                {
                  key: "outstandingBalance",
                  header: "Outstanding",
                  render: money,
                },
                { key: "status", header: "Status" },
              ]}
              emptyTitle="No rent obligations"
            />
            <h3>Payment evidence</h3>
            <DataTable
              rows={lease.payments || []}
              columns={[
                { key: "transactionReference", header: "Reference" },
                { key: "amount", header: "Amount", render: money },
                { key: "status", header: "Status" },
                {
                  key: "actions",
                  header: "Review",
                  render: (_, payment) =>
                    payment.status === "PENDING_VERIFICATION" ? (
                      <div className="ca-actions">
                        <Button
                          onClick={() =>
                            act(
                              () =>
                                communityAdminService.reviewRentalPayment(
                                  payment.id,
                                  "VERIFIED",
                                ),
                              "Payment evidence verified.",
                            )
                          }
                        >
                          Verify
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() =>
                            act(
                              () =>
                                communityAdminService.reviewRentalPayment(
                                  payment.id,
                                  "REJECTED",
                                ),
                              "Payment evidence rejected.",
                            )
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    ) : payment.status === "VERIFIED" ? (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setRentRefund({
                            ...rentRefund,
                            paymentId: payment.id,
                          })
                        }
                      >
                        Record refund
                      </Button>
                    ) : (
                      "—"
                    ),
                },
              ]}
              emptyTitle="No payment records"
            />
            {rentRefund.paymentId &&
              lease.payments.some(
                (payment) => payment.id === rentRefund.paymentId,
              ) && (
                <form className="ca-form" onSubmit={submitRentRefund}>
                  <Input
                    label="Refund amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={rentRefund.amount}
                    onChange={(event) =>
                      setRentRefund({
                        ...rentRefund,
                        amount: event.target.value,
                      })
                    }
                  />
                  <Input
                    label="Reason"
                    required
                    value={rentRefund.reason}
                    onChange={(event) =>
                      setRentRefund({
                        ...rentRefund,
                        reason: event.target.value,
                      })
                    }
                  />
                  <Input
                    label="Refund reference"
                    required
                    value={rentRefund.transactionReference}
                    onChange={(event) =>
                      setRentRefund({
                        ...rentRefund,
                        transactionReference: event.target.value,
                      })
                    }
                  />
                  <Button type="submit" loading={saving}>
                    Record rent refund
                  </Button>
                </form>
              )}
            <DataTable
              rows={lease.refunds || []}
              columns={[
                { key: "transactionReference", header: "Refund reference" },
                { key: "amount", header: "Amount", render: money },
                { key: "reason", header: "Reason" },
                { key: "status", header: "Status" },
              ]}
              emptyTitle="No rent refunds"
            />
            <h3>Deposit record</h3>
            <p>
              {money(lease.deposit?.collected)} collected ·{" "}
              {money(lease.deposit?.deductions)} deducted ·{" "}
              {money(lease.deposit?.refunded)} refunded ·{" "}
              {money(lease.deposit?.held)} held ({lease.deposit?.status})
            </p>
            <DataTable
              rows={lease.deposit?.history || []}
              columns={[
                { key: "type", header: "Entry" },
                { key: "amount", header: "Amount", render: money },
                { key: "reason", header: "Reason" },
                { key: "disputeReason", header: "Tenant dispute" },
                { key: "status", header: "Status" },
                {
                  key: "actions",
                  header: "Review",
                  render: (_, entry) =>
                    entry.status === "PENDING_VERIFICATION" &&
                    entry.type === "COLLECTION" ? (
                      <div className="ca-actions">
                        <Button
                          onClick={() =>
                            act(
                              () =>
                                communityAdminService.reviewRentalDeposit(
                                  entry.id,
                                  "VERIFIED",
                                ),
                              "Deposit evidence verified.",
                            )
                          }
                        >
                          Verify
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() =>
                            act(
                              () =>
                                communityAdminService.reviewRentalDeposit(
                                  entry.id,
                                  "REJECTED",
                                ),
                              "Deposit evidence rejected.",
                            )
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    ) : entry.type === "DEDUCTION" &&
                      entry.status === "DISPUTED" ? (
                      <div className="ca-actions">
                        <Button
                          onClick={() =>
                            setResolution({
                              entryId: entry.id,
                              decision: "VERIFIED",
                              reason: "",
                            })
                          }
                        >
                          Resolve as accepted
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setResolution({
                              entryId: entry.id,
                              decision: "REJECTED",
                              reason: "",
                            })
                          }
                        >
                          Reject deduction
                        </Button>
                      </div>
                    ) : (
                      "—"
                    ),
                },
              ]}
              emptyTitle="No deposit activity"
            />
            {resolution &&
              lease.deposit?.history.some(
                (entry) => entry.id === resolution.entryId,
              ) && (
                <form className="ca-form" onSubmit={submitResolution}>
                  <Input
                    label="Resolution reason"
                    required
                    value={resolution.reason}
                    onChange={(event) =>
                      setResolution({
                        ...resolution,
                        reason: event.target.value,
                      })
                    }
                  />
                  <Button type="submit" loading={saving}>
                    Save dispute resolution
                  </Button>
                </form>
              )}
            {lease.status !== "ACTIVE" && (
              <form
                className="ca-form ca-rentals__adjustment"
                onSubmit={submitAdjustment}
              >
                <Select
                  label="Deposit action"
                  value={
                    adjustment.leaseId === lease.id
                      ? adjustment.type
                      : "DEDUCTION"
                  }
                  onChange={(event) =>
                    setAdjustment({
                      ...adjustment,
                      leaseId: lease.id,
                      type: event.target.value,
                    })
                  }
                >
                  <option value="DEDUCTION">Record deduction</option>
                  <option value="REFUND">Record refund</option>
                </Select>
                <Input
                  label="Amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={
                    adjustment.leaseId === lease.id ? adjustment.amount : ""
                  }
                  onChange={(event) =>
                    setAdjustment({
                      ...adjustment,
                      leaseId: lease.id,
                      amount: event.target.value,
                    })
                  }
                />
                <Input
                  label="Reason"
                  required
                  value={
                    adjustment.leaseId === lease.id ? adjustment.reason : ""
                  }
                  onChange={(event) =>
                    setAdjustment({
                      ...adjustment,
                      leaseId: lease.id,
                      reason: event.target.value,
                    })
                  }
                />
                {adjustment.type === "REFUND" && (
                  <Input
                    label="Refund reference"
                    required
                    value={
                      adjustment.leaseId === lease.id
                        ? adjustment.transactionReference
                        : ""
                    }
                    onChange={(event) =>
                      setAdjustment({
                        ...adjustment,
                        leaseId: lease.id,
                        transactionReference: event.target.value,
                      })
                    }
                  />
                )}
                <Button type="submit" loading={saving}>
                  Record deposit action
                </Button>
              </form>
            )}
            {lease.status === "PENDING_APPROVAL" && (
              <Button
                onClick={() =>
                  setReview({
                    id: lease.id,
                    decision: "APPROVED",
                    reason: "",
                  })
                }
              >
                Review lease approval / rejection
              </Button>
            )}
            <h3>Tenant requests</h3>
            {(lease.requests || []).length ? (
              lease.requests.map((request) => (
                <div key={request.id}>
                  <p>
                    {request.type} · {request.status}
                    {request.successorLeaseId
                      ? ` · successor lease ${request.successorLeaseId}`
                      : ""}
                  </p>
                  {request.renewalTerms && (
                    <p className="ca-muted">
                      Renewal terms: {money(request.renewalTerms.monthlyRent)}{" "}
                      monthly · deposit{" "}
                      {money(request.renewalTerms.securityDeposit)} · due day{" "}
                      {request.renewalTerms.dueDay} ·{" "}
                      {date(request.renewalTerms.startDate)} to{" "}
                      {date(request.renewalTerms.endDate)}
                      {request.renewalTerms.escalation
                        ? ` · ${request.renewalTerms.escalation.method} escalation`
                        : " · no inherited escalation"}
                    </p>
                  )}
                  {request.status === "PENDING" && (
                    <span className="ca-actions">
                      <Button
                        onClick={() =>
                          act(
                            () =>
                              communityAdminService.decideRentalRequest(
                                request.id,
                                "APPROVED",
                              ),
                            "Tenant request approved.",
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() =>
                          act(
                            () =>
                              communityAdminService.decideRentalRequest(
                                request.id,
                                "DECLINED",
                              ),
                            "Tenant request declined.",
                          )
                        }
                      >
                        Decline
                      </Button>
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="ca-muted">No lease requests.</p>
            )}
          </Modal>
        ))}
      <Modal
        isOpen={Boolean(review)}
        title="Review rental arrangement"
        onClose={saving ? undefined : () => setReview(null)}
      >
        {review && (
          <form
            className="ca-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await communityAdminService.reviewRentalLease(
                  review.id,
                  review.decision,
                  review.reason,
                );
                showToast({ type: "success", message: "Rental review saved." });
                setReview(null);
                await reload();
              } catch (error) {
                showToast({ type: "error", message: error.message });
              } finally {
                setSaving(false);
              }
            }}
          >
            <Select
              label="Decision"
              disabled={saving}
              value={review.decision}
              onChange={(event) =>
                setReview({ ...review, decision: event.target.value })
              }
            >
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
            </Select>
            <Input
              label="Reason"
              required
              maxLength={500}
              disabled={saving}
              value={review.reason}
              onChange={(event) =>
                setReview({ ...review, reason: event.target.value })
              }
            />
            <Button type="submit" loading={saving}>
              Save decision
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
