import { useCallback, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
  useToast,
} from "../../../components/ui/index.js";
import { DataTable } from "../../../components/data-display/DataTable.jsx";
import { PageHeader } from "../../../components/data-display/PageHeader.jsx";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";

const money = (amount) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
  }).format(Number(amount || 0));
const formatDate = (value) => {
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
const listingColumns = [
  {
    key: "apartmentNumber",
    header: "Apartment",
    render: (value, row) => value || row.apartmentLabel || row.apartmentId,
  },
  { key: "monthlyRent", header: "Monthly rent", render: money },
  { key: "securityDeposit", header: "Security deposit", render: money },
  { key: "availableFrom", header: "Available from", render: formatDate },
  { key: "details", header: "Details", render: (value) => value || "—" },
];
const obligationColumns = [
  { key: "billingPeriod", header: "Billing period" },
  { key: "dueDate", header: "Due date", render: formatDate },
  { key: "amountDue", header: "Amount due", render: money },
  { key: "amountPaid", header: "Verified payments", render: money },
  { key: "status", header: "Status" },
];

function LeaseCard({ lease, onRefresh }) {
  const { showToast } = useToast();
  const [paymentForms, setPaymentForms] = useState({});
  const [depositForm, setDepositForm] = useState({
    amount: "",
    transactionReference: "",
  });
  const [renewal, setRenewal] = useState({
    startDate: "",
    endDate: "",
    monthlyRent: lease.currentMonthlyRent ?? lease.monthlyRent,
    securityDeposit: lease.securityDeposit,
    dueDay: lease.dueDay,
    escalationMethod: "NONE",
    escalationValue: "",
    escalationDate: "",
    escalationInterval: "12",
  });
  const [disputeReason, setDisputeReason] = useState("");
  const request = async (type, terms) => {
    try {
      await residentService.requestLeaseChange(lease.id, type, terms);
      showToast({
        type: "success",
        message: `${type === "RENEWAL" ? "Renewal" : "Termination"} request submitted.`,
      });
      await onRefresh();
    } catch (error) {
      showToast({
        type: "error",
        message: error.message || "Unable to submit lease request.",
      });
    }
  };
  const submitDepositEvidence = async (event) => {
    event.preventDefault();
    try {
      await residentService.submitDepositEvidence(lease.id, {
        amount: Number(depositForm.amount),
        transactionReference: depositForm.transactionReference,
      });
      showToast({
        type: "success",
        message: "Deposit evidence recorded for recipient review.",
      });
      setDepositForm({ amount: "", transactionReference: "" });
      await onRefresh();
    } catch (error) {
      showToast({
        type: "error",
        message: error.message || "Unable to record deposit evidence.",
      });
    }
  };
  const acceptTerms = async () => {
    try {
      await residentService.acceptRentalLease(lease.id);
      showToast({
        type: "success",
        message:
          "Lease terms accepted. The Community Admin must activate the lease.",
      });
      await onRefresh();
    } catch (error) {
      showToast({
        type: "error",
        message: error.message || "Unable to accept lease terms.",
      });
    }
  };
  const submitEvidence = async (event, obligation) => {
    event.preventDefault();
    const form = paymentForms[obligation.id] || {};
    try {
      await residentService.submitPaymentEvidence(lease.id, obligation.id, {
        amount: Number(form.amount),
        transactionReference: form.transactionReference,
      });
      showToast({
        type: "success",
        message: "Payment evidence recorded for recipient review.",
      });
      setPaymentForms((current) => ({
        ...current,
        [obligation.id]: { amount: "", transactionReference: "" },
      }));
      await onRefresh();
    } catch (error) {
      showToast({
        type: "error",
        message: error.message || "Unable to record payment evidence.",
      });
    }
  };
  return (
    <Card title={`Lease · ${lease.status}`}>
      {lease.requiresReview && (
        <ErrorState
          title="Lease needs admin review"
          message="Approval or rent recipient information is incomplete. Contact your Community Admin before proceeding."
        />
      )}
      <dl className="resident-facts">
        <div>
          <dt>Current monthly rent</dt>
          <dd>{money(lease.currentMonthlyRent ?? lease.monthlyRent)}</dd>
        </div>
        {lease.nextRentIncrease && (
          <div>
            <dt>Scheduled rent increase</dt>
            <dd>
              {money(lease.nextRentIncrease.amount)} from{" "}
              {formatDate(lease.nextRentIncrease.date)}
            </dd>
          </div>
        )}
        {lease.escalation && (
          <div>
            <dt>Agreed escalation</dt>
            <dd>
              {lease.escalation.method === "PERCENTAGE"
                ? `${lease.escalation.value}%`
                : money(lease.escalation.value)}{" "}
              every {lease.escalation.intervalMonths} months
            </dd>
          </div>
        )}
        <div>
          <dt>Security deposit</dt>
          <dd>
            {money(lease.securityDeposit)} agreed ·{" "}
            {money(lease.deposit?.collected)} collected
          </dd>
        </div>
        <div>
          <dt>Deposit status</dt>
          <dd>
            {lease.deposit?.status}; {money(lease.deposit?.held)} held,{" "}
            {money(lease.deposit?.deductions)} deducted,{" "}
            {money(lease.deposit?.refunded)} refunded
          </dd>
        </div>
        <div>
          <dt>Start date</dt>
          <dd>{formatDate(lease.startDate)}</dd>
        </div>
        <div>
          <dt>End date</dt>
          <dd>{formatDate(lease.endDate)}</dd>
        </div>
        <div>
          <dt>Rent due</dt>
          <dd>Day {lease.dueDay} of each month</dd>
        </div>
        <div>
          <dt>Rent recipient</dt>
          <dd>{lease.payeeId || "Awaiting admin reconciliation"}</dd>
        </div>
      </dl>
      <div className="resident-rentals__table">
        <h3>Rent obligations</h3>
        <DataTable
          rows={lease.obligations || []}
          columns={obligationColumns}
          emptyTitle="No rent obligations"
        />
      </div>
      {lease.obligations?.some((item) => item.amountPaid < item.amountDue) && (
        <div className="resident-rentals__table">
          <h3>Record payment evidence</h3>
          <p className="resident-muted">
            This records a payment reference for manual review. It does not
            transfer money or verify a payment.
          </p>
          {lease.obligations
            .filter((item) => item.amountPaid < item.amountDue)
            .map((item) => (
              <form
                className="resident-rentals__payment"
                key={item.id}
                onSubmit={(event) => submitEvidence(event, item)}
              >
                <strong>
                  {item.billingPeriod} · balance{" "}
                  {money(item.amountDue - item.amountPaid)}
                </strong>
                <Input
                  label="Amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={paymentForms[item.id]?.amount || ""}
                  onChange={(event) =>
                    setPaymentForms((current) => ({
                      ...current,
                      [item.id]: {
                        ...current[item.id],
                        amount: event.target.value,
                      },
                    }))
                  }
                />
                <Input
                  label="Transaction reference"
                  maxLength={120}
                  required
                  value={paymentForms[item.id]?.transactionReference || ""}
                  onChange={(event) =>
                    setPaymentForms((current) => ({
                      ...current,
                      [item.id]: {
                        ...current[item.id],
                        transactionReference: event.target.value,
                      },
                    }))
                  }
                />
                <Button type="submit">Record evidence</Button>
              </form>
            ))}
        </div>
      )}
      <div className="resident-rentals__table">
        <h3>Payment records</h3>
        <DataTable
          rows={lease.payments || []}
          columns={[
            { key: "transactionReference", header: "Reference" },
            { key: "amount", header: "Amount", render: money },
            { key: "createdAt", header: "Recorded", render: formatDate },
            { key: "status", header: "Status" },
          ]}
          emptyTitle="No payment records"
        />
      </div>
      <div className="resident-rentals__table">
        <h3>Rent refund history</h3>
        <DataTable
          rows={lease.refunds || []}
          columns={[
            { key: "transactionReference", header: "Refund reference" },
            { key: "amount", header: "Amount", render: money },
            { key: "reason", header: "Reason" },
            { key: "status", header: "Status" },
            {
              key: "actions",
              header: "Action",
              render: (_, refund) =>
                refund.status === "PENDING_TENANT_CONFIRMATION" ? (
                  <div className="resident-actions">
                    <Button
                      onClick={async () => {
                        try {
                          await residentService.reviewRentalRefund(
                            refund.id,
                            "VERIFIED",
                          );
                          showToast({
                            type: "success",
                            message: "Rent refund confirmed.",
                          });
                          await onRefresh();
                        } catch (error) {
                          showToast({ type: "error", message: error.message });
                        }
                      }}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await residentService.reviewRentalRefund(
                            refund.id,
                            "REJECTED",
                          );
                          showToast({
                            type: "success",
                            message: "Rent refund evidence rejected.",
                          });
                          await onRefresh();
                        } catch (error) {
                          showToast({ type: "error", message: error.message });
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  "—"
                ),
            },
          ]}
          emptyTitle="No rent refunds"
        />
      </div>
      <div className="resident-rentals__table">
        <p>
          Rent recipient: {lease.payeeId || "Awaiting admin reconciliation"}.
          Ownership and rent payments are separate from community maintenance
          charges.
        </p>
        <h3>Deposit history</h3>
        <DataTable
          rows={lease.deposit?.history || []}
          columns={[
            { key: "type", header: "Entry" },
            { key: "amount", header: "Amount", render: money },
            { key: "reason", header: "Reason" },
            { key: "disputeReason", header: "Tenant decision / dispute" },
            { key: "status", header: "Status" },
            {
              key: "actions",
              header: "Action",
              render: (_, entry) =>
                entry.status === "PENDING_VERIFICATION" &&
                entry.type === "REFUND" ? (
                  <div className="resident-actions">
                    <Button
                      onClick={async () => {
                        try {
                          await residentService.reviewDeposit(
                            entry.id,
                            "VERIFIED",
                          );
                          showToast({
                            type: "success",
                            message: "Refund confirmed.",
                          });
                          await onRefresh();
                        } catch (error) {
                          showToast({ type: "error", message: error.message });
                        }
                      }}
                    >
                      Confirm refund
                    </Button>
                    <Button
                      variant="danger"
                      onClick={async () => {
                        try {
                          await residentService.reviewDeposit(
                            entry.id,
                            "REJECTED",
                          );
                          showToast({
                            type: "success",
                            message: "Refund evidence rejected.",
                          });
                          await onRefresh();
                        } catch (error) {
                          showToast({ type: "error", message: error.message });
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ) : entry.type === "DEDUCTION" &&
                  entry.status === "PENDING_TENANT_CONFIRMATION" ? (
                  <div className="resident-actions">
                    <Button
                      onClick={async () => {
                        try {
                          await residentService.decideDepositDeduction(
                            entry.id,
                            "ACCEPTED",
                          );
                          showToast({
                            type: "success",
                            message: "Deposit deduction accepted.",
                          });
                          await onRefresh();
                        } catch (error) {
                          showToast({ type: "error", message: error.message });
                        }
                      }}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        if (!disputeReason.trim()) return;
                        try {
                          await residentService.decideDepositDeduction(
                            entry.id,
                            "DISPUTED",
                            disputeReason,
                          );
                          setDisputeReason("");
                          showToast({
                            type: "success",
                            message: "Deposit deduction disputed.",
                          });
                          await onRefresh();
                        } catch (error) {
                          showToast({ type: "error", message: error.message });
                        }
                      }}
                    >
                      Dispute
                    </Button>
                    <Input
                      label="Dispute reason"
                      required
                      value={disputeReason}
                      onChange={(event) => setDisputeReason(event.target.value)}
                    />
                  </div>
                ) : (
                  "—"
                ),
            },
          ]}
          emptyTitle="No deposit history"
        />
      </div>
      {lease.status === "ACTIVE" &&
        lease.securityDeposit > lease.deposit?.collected && (
          <form
            className="resident-rentals__payment"
            onSubmit={submitDepositEvidence}
          >
            <strong>Record deposit collection evidence</strong>
            <Input
              label="Amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={depositForm.amount}
              onChange={(event) =>
                setDepositForm({ ...depositForm, amount: event.target.value })
              }
            />
            <Input
              label="Transaction reference"
              maxLength={120}
              required
              value={depositForm.transactionReference}
              onChange={(event) =>
                setDepositForm({
                  ...depositForm,
                  transactionReference: event.target.value,
                })
              }
            />
            <Button type="submit">Record deposit evidence</Button>
          </form>
        )}
      {lease.reminders?.leaseExpiry && (
        <p className="resident-muted">
          Lease expiry is approaching: {formatDate(lease.reminders.leaseExpiry)}
          .
        </p>
      )}
      {!!lease.reminders?.upcomingRent?.length && (
        <p className="resident-muted">
          Rent due soon:{" "}
          {lease.reminders.upcomingRent
            .map((item) => formatDate(item.dueDate))
            .join(", ")}
          .
        </p>
      )}
      {!!lease.reminders?.overdueRent?.length && (
        <p className="resident-muted">
          Overdue rent: {lease.reminders.overdueRent.length} obligation(s) have
          a balance.
        </p>
      )}
      {lease.status === "ACTIVE" && (
        <div className="resident-actions">
          <Button variant="secondary" onClick={() => request("RENEWAL")}>
            Request renewal
          </Button>
          <Button variant="secondary" onClick={() => request("TERMINATION")}>
            Request termination
          </Button>
        </div>
      )}
      {lease.status === "ACTIVE" && (
        <form
          className="resident-rentals__payment"
          onSubmit={(event) => {
            event.preventDefault();
            const {
              escalationMethod,
              escalationValue,
              escalationDate,
              escalationInterval,
              ...terms
            } = renewal;
            const escalation =
              escalationMethod === "NONE"
                ? undefined
                : {
                    method: escalationMethod,
                    value: Number(escalationValue),
                    effectiveDate: escalationDate,
                    intervalMonths: Number(escalationInterval),
                  };
            request("RENEWAL", {
              ...terms,
              monthlyRent: Number(terms.monthlyRent),
              securityDeposit: Number(terms.securityDeposit),
              dueDay: Number(terms.dueDay),
              ...(escalation ? { escalation } : {}),
            });
          }}
        >
          <strong>Propose renewal terms</strong>
          <Input
            label="New start date"
            type="date"
            required
            value={renewal.startDate}
            onChange={(event) =>
              setRenewal({ ...renewal, startDate: event.target.value })
            }
          />
          <Input
            label="New end date"
            type="date"
            required
            value={renewal.endDate}
            onChange={(event) =>
              setRenewal({ ...renewal, endDate: event.target.value })
            }
          />
          <Input
            label="Monthly rent"
            type="number"
            min="0"
            step="0.01"
            required
            value={renewal.monthlyRent}
            onChange={(event) =>
              setRenewal({ ...renewal, monthlyRent: event.target.value })
            }
          />
          <Input
            label="Security deposit"
            type="number"
            min="0"
            step="0.01"
            required
            value={renewal.securityDeposit}
            onChange={(event) =>
              setRenewal({ ...renewal, securityDeposit: event.target.value })
            }
          />
          <Input
            label="Rent due day"
            type="number"
            min="1"
            max="31"
            required
            value={renewal.dueDay}
            onChange={(event) =>
              setRenewal({ ...renewal, dueDay: event.target.value })
            }
          />
          <Select
            label="New escalation schedule"
            value={renewal.escalationMethod}
            onChange={(event) =>
              setRenewal({ ...renewal, escalationMethod: event.target.value })
            }
          >
            <option value="NONE">No escalation</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed increase</option>
          </Select>
          {renewal.escalationMethod !== "NONE" && (
            <>
              <Input
                label="Increase value"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={renewal.escalationValue}
                onChange={(event) =>
                  setRenewal({
                    ...renewal,
                    escalationValue: event.target.value,
                  })
                }
              />
              <Input
                label="First effective month"
                type="date"
                required
                value={renewal.escalationDate}
                onChange={(event) =>
                  setRenewal({ ...renewal, escalationDate: event.target.value })
                }
              />
              <Input
                label="Interval in months"
                type="number"
                min="1"
                max="120"
                required
                value={renewal.escalationInterval}
                onChange={(event) =>
                  setRenewal({
                    ...renewal,
                    escalationInterval: event.target.value,
                  })
                }
              />
            </>
          )}
          <Button type="submit">Submit renewal terms</Button>
        </form>
      )}
      <div className="resident-rentals__table">
        <h3>Rent amendment proposals</h3>
        <DataTable
          rows={lease.amendments || []}
          columns={[
            { key: "effectiveDate", header: "Effective", render: formatDate },
            { key: "reason", header: "Reason" },
            {
              key: "terms",
              header: "Proposed terms",
              render: (terms) =>
                [
                  terms.monthlyRent !== undefined
                    ? `${money(terms.monthlyRent)} monthly rent`
                    : null,
                  terms.dueDay ? `due day ${terms.dueDay}` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
            },
            { key: "status", header: "Status" },
            {
              key: "actions",
              header: "Decision",
              render: (_, item) =>
                item.status === "PENDING_TENANT_ACCEPTANCE" ? (
                  <div className="resident-actions">
                    <Button
                      onClick={async () => {
                        try {
                          await residentService.decideRentAmendment(
                            item.id,
                            "ACCEPTED",
                          );
                          showToast({
                            type: "success",
                            message: "Rent amendment accepted.",
                          });
                          await onRefresh();
                        } catch (error) {
                          showToast({ type: "error", message: error.message });
                        }
                      }}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await residentService.decideRentAmendment(
                            item.id,
                            "REJECTED",
                          );
                          showToast({
                            type: "success",
                            message: "Rent amendment rejected.",
                          });
                          await onRefresh();
                        } catch (error) {
                          showToast({ type: "error", message: error.message });
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  "—"
                ),
            },
          ]}
          emptyTitle="No rent amendments"
        />
      </div>
      {lease.status === "PENDING_APPROVAL" && (
        <Button onClick={acceptTerms} disabled={lease.tenantAccepted}>
          {lease.tenantAccepted
            ? "Terms accepted · awaiting Community Admin activation"
            : "Accept lease terms"}
        </Button>
      )}
      {(lease.requests || []).map((item) => (
        <p key={item.id} className="resident-muted">
          {item.type} request: {item.status}
          {item.successorLeaseId ? ` · successor ${item.successorLeaseId}` : ""}
          {item.type === "RENEWAL" && item.renewalTerms
            ? ` · ${money(item.renewalTerms.monthlyRent)} monthly, deposit ${money(item.renewalTerms.securityDeposit)}, due day ${item.renewalTerms.dueDay}, ${formatDate(item.renewalTerms.startDate)}–${formatDate(item.renewalTerms.endDate)}`
            : ""}
          {item.status === "PENDING" && (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await residentService.withdrawRentalRequest(item.id);
                  showToast({
                    type: "success",
                    message: "Lease request withdrawn.",
                  });
                  await onRefresh();
                } catch (error) {
                  showToast({ type: "error", message: error.message });
                }
              }}
            >
              Withdraw request
            </Button>
          )}
        </p>
      ))}
    </Card>
  );
}

function RentalHistory({ leases = [] }) {
  if (!leases.length) return null;
  return (
    <Card title="Historical private rental records">
      <p className="resident-muted">
        Read-only records from the previous model. New private rentals and
        payments are managed outside Urbanity.
      </p>
      {leases.map((lease) => (
        <details key={lease.id}>
          <summary>
            {lease.tenant?.name || "Lease"} &middot;{" "}
            {formatDate(lease.startDate)} &ndash; {formatDate(lease.endDate)}{" "}
            &middot; {lease.status}
          </summary>
          <DataTable
            rows={lease.obligations || []}
            columns={obligationColumns}
            emptyTitle="No historical obligations"
          />
          <DataTable
            rows={lease.payments || []}
            columns={[
              { key: "transactionReference", header: "Payment reference" },
              { key: "amount", header: "Amount", render: money },
              { key: "status", header: "Status" },
            ]}
            emptyTitle="No historical payments"
          />
          <p>
            Deposit collected: {money(lease.deposit?.collected)} &middot;
            Refunded: {money(lease.deposit?.refunded)}
          </p>
          <DataTable
            rows={lease.refunds || []}
            columns={[
              { key: "transactionReference", header: "Rent refund reference" },
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
    </Card>
  );
}

export function RentalsPage() {
  const loader = useCallback(() => residentService.getRentals(), []);
  const { data, loading, error, reload } = useResidentResource(loader);
  return (
    <div className="resident-stack resident-rentals">
      <PageHeader
        eyebrow="Resident services"
        title="Rentals & leases"
        description="Review rental availability, your lease terms, rent schedule, payment records, and deposit information."
      />
      {loading && <LoadingState message="Loading rental information…" />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && (
        <>
          <Card title="Available listings">
            <p className="resident-muted">
              Rental listings available in your community.
            </p>
            {data.listings?.length ? (
              <div className="resident-rentals__table">
                <DataTable
                  rows={data.listings}
                  columns={listingColumns}
                  emptyTitle="No available listings"
                />
              </div>
            ) : (
              <EmptyState
                title="No available listings"
                message="There are no currently published rentals in your community."
              />
            )}
          </Card>
          <Card title="My apartment relationships">
            <DataTable
              rows={data.inventory || []}
              columns={[
                { key: "apartmentNumber", header: "Apartment" },
                { key: "occupancy", header: "Occupancy" },
              ]}
              emptyTitle="No current apartment relationship"
            />
          </Card>
          <RentalHistory
            leases={[
              ...(data.managedLeases || []),
              ...(data.leases || []).filter(
                (lease) => lease.arrangement === "OWNER",
              ),
            ].filter(
              (lease, index, all) =>
                all.findIndex((item) => item.id === lease.id) === index,
            )}
          />
          <section className="resident-stack" aria-label="My leases">
            <h2 className="resident-rentals__heading">My leases</h2>
            {data.leases?.some((lease) => lease.arrangement === "COMMUNITY") ? (
              data.leases
                .filter((lease) => lease.arrangement === "COMMUNITY")
                .map((lease) => (
                  <LeaseCard key={lease.id} lease={lease} onRefresh={reload} />
                ))
            ) : (
              <EmptyState
                title="No rental leases"
                message="Your lease information will appear here when a lease is created for you."
              />
            )}
          </section>
          <p className="resident-muted">
            Payment and deposit references are records for manual review; they
            do not transfer money or verify a gateway transaction. Due and
            expiry dates are shown in Urbanity when available; no automatic
            reminders are delivered.
          </p>
        </>
      )}
    </div>
  );
}
