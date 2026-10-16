import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, Select, Textarea, useToast } from "../../../components/ui/index.js";
import { DataTable, PageHeader } from "../../../components/data-display/index.js";
import { useCommunityResource } from "../hooks/useCommunityResource.js";
import { communityAdminService } from "../services/communityAdminService.js";

const money = (value) => new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(Number(value || 0));
const date = (value) => {
  if (!value) return "Not available";
  const dateOnlyValue = /^\d{4}-\d{2}-\d{2}$/.test(value) || /T23:59:59\.999Z$/.test(value) ? value.slice(0, 10) : null;
  const parsed = dateOnlyValue ? new Date(`${dateOnlyValue}T12:00:00`) : new Date(value);
  return parsed.toLocaleDateString();
};
const apartmentText = (item, data) => {
  const apartment = data.apartments.find((a) => a.id === item.apartmentId);
  const floor = data.floors.find((f) => f.id === apartment?.floorId);
  const tower = data.towers.find((t) => t.id === floor?.towerId);
  return [tower?.name, floor?.label, apartment?.apartmentNumber].filter(Boolean).join(" · ") || item.apartmentId;
};

export function RentalsPage() {
  const { showToast } = useToast();
  const loader = useCallback(async () => {
    const [listings, leases, apartments, floors, towers] = await Promise.all([
      communityAdminService.listRentalListings(), communityAdminService.listRentalLeases(),
      communityAdminService.listApartments(), communityAdminService.listFloors(), communityAdminService.listTowers(),
    ]);
    return { listings, leases, apartments, floors, towers };
  }, []);
  const { data, loading, error, reload } = useCommunityResource(loader);
  const [listingForm, setListingForm] = useState({ apartmentId: "", monthlyRent: "", securityDeposit: "", availableFrom: "", details: "" });
  const [leaseForm, setLeaseForm] = useState({ listingId: "", tenantId: "", startDate: "", endDate: "", dueDay: "1", escalationMethod: "NONE", escalationValue: "", escalationDate: "", escalationInterval: "12" });
  const [tenants, setTenants] = useState([]);
  const [adjustment, setAdjustment] = useState({ leaseId: "", type: "DEDUCTION", amount: "", reason: "", transactionReference: "" });
  const [rentRefund, setRentRefund] = useState({ paymentId: "", amount: "", reason: "", transactionReference: "" });
  const [amendment, setAmendment] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const availableListings = useMemo(() => (data?.listings || []).filter((item) => item.status === "AVAILABLE"), [data]);
  const apartments = useMemo(() => {
    if (!data) return [];
    return data.apartments.map((item) => ({ ...item, label: apartmentText(item, data) }));
  }, [data]);

  useEffect(() => {
    if (!leaseForm.listingId) { setTenants([]); return; }
    let active = true;
    communityAdminService.listRentalTenants(leaseForm.listingId).then((items) => { if (active) setTenants(items); }).catch((requestError) => { if (active) showToast({ type: "error", message: requestError.message }); });
    return () => { active = false; };
  }, [leaseForm.listingId, showToast]);

  const act = async (operation, message) => {
    setSaving(true);
    try { await operation(); showToast({ type: "success", message }); await reload(); }
    catch (requestError) { showToast({ type: "error", message: requestError.message || "Rental operation failed." }); }
    finally { setSaving(false); }
  };
  const createListing = (event) => {
    event.preventDefault();
    act(() => communityAdminService.createRentalListing({ apartmentId: listingForm.apartmentId, arrangement: "COMMUNITY", monthlyRent: Number(listingForm.monthlyRent), securityDeposit: Number(listingForm.securityDeposit), availableFrom: listingForm.availableFrom, details: listingForm.details }), "Draft rental listing created.");
    setListingForm({ apartmentId: "", monthlyRent: "", securityDeposit: "", availableFrom: "", details: "" });
  };
  const createLease = (event) => {
    event.preventDefault();
    const { escalationMethod, escalationValue, escalationDate, escalationInterval, ...terms } = leaseForm;
    const escalation = escalationMethod === "NONE" ? undefined : { method: escalationMethod, value: Number(escalationValue), effectiveDate: escalationDate, intervalMonths: Number(escalationInterval) };
    act(() => communityAdminService.createRentalLease({ ...terms, dueDay: Number(leaseForm.dueDay), ...(escalation ? { escalation } : {}) }), "Lease proposal created.");
    setLeaseForm((current) => ({ ...current, tenantId: "", startDate: "", endDate: "" }));
  };
  const saveListing = (event) => {
    event.preventDefault();
    act(() => communityAdminService.updateRentalListing(editing.id, { monthlyRent: Number(editing.monthlyRent), securityDeposit: Number(editing.securityDeposit), availableFrom: editing.availableFrom, details: editing.details }), "Rental listing updated.");
    setEditing(null);
  };
  const submitAdjustment = (event) => {
    event.preventDefault();
    const payload = { amount: Number(adjustment.amount), reason: adjustment.reason, ...(adjustment.type === "REFUND" ? { transactionReference: adjustment.transactionReference } : {}) };
    act(() => adjustment.type === "REFUND" ? communityAdminService.createDepositRefund(adjustment.leaseId, payload) : communityAdminService.createDepositDeduction(adjustment.leaseId, payload), adjustment.type === "REFUND" ? "Refund recorded for tenant confirmation." : "Deposit deduction recorded.");
    setAdjustment((current) => ({ ...current, amount: "", reason: "", transactionReference: "" }));
  };
  const submitRentRefund = (event) => {
    event.preventDefault();
    act(() => communityAdminService.recordRentalRefund(rentRefund.paymentId, { amount: Number(rentRefund.amount), reason: rentRefund.reason, transactionReference: rentRefund.transactionReference }), "Rent refund recorded for tenant confirmation.");
    setRentRefund({ paymentId: "", amount: "", reason: "", transactionReference: "" });
  };
  const submitAmendment = (event) => { event.preventDefault(); const { leaseId, monthlyRent, effectiveDate, reason } = amendment; act(() => communityAdminService.proposeRentAmendment(leaseId, { monthlyRent: Number(monthlyRent), effectiveDate, reason }), "Amendment sent to the tenant for a decision."); setAmendment(null); };
  const submitResolution = (event) => { event.preventDefault(); act(() => communityAdminService.resolveDepositDispute(resolution.entryId, resolution.decision, resolution.reason), `Disputed deduction ${resolution.decision.toLowerCase()}.`); setResolution(null); };

  const listingColumns = useMemo(() => [
    { key: "apartmentId", header: "Apartment", render: (_, row) => apartmentText(row, data) },
    { key: "monthlyRent", header: "Monthly rent", render: money },
    { key: "securityDeposit", header: "Deposit", render: money },
    { key: "availableFrom", header: "Available", render: date },
    { key: "status", header: "Status" },
    { key: "actions", header: "Actions", render: (_, row) => <div className="ca-actions"><Button variant="secondary" onClick={() => setEditing({ ...row })}>Edit</Button>{row.status === "DRAFT" && <Button onClick={() => act(() => communityAdminService.updateRentalListing(row.id, { status: "AVAILABLE" }), "Listing published.")}>Publish</Button>}{row.status === "AVAILABLE" && <Button variant="secondary" onClick={() => act(() => communityAdminService.updateRentalListing(row.id, { status: "WITHDRAWN" }), "Listing withdrawn.")}>Withdraw</Button>}{row.status === "WITHDRAWN" && <Button variant="secondary" onClick={() => act(() => communityAdminService.updateRentalListing(row.id, { status: "AVAILABLE" }), "Listing published.")}>Republish</Button>}</div> },
  ], [data]);
  const leaseColumns = useMemo(() => [
    { key: "apartmentId", header: "Apartment", render: (_, row) => apartmentText(row, data) },
    { key: "tenant", header: "Tenant", render: (value) => value?.name || "Unknown" },
    { key: "monthlyRent", header: "Rent", render: money },
    { key: "startDate", header: "Start", render: date }, { key: "endDate", header: "End", render: date }, { key: "status", header: "Status" },
  ], [data]);
  if (loading) return <LoadingState message="Loading rental management..." />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  return <div className="ca-stack ca-rentals">
    <PageHeader eyebrow="Property operations" title="Rental management" description="Manage community-authorized listings, leases, payment evidence, deposits, and tenant requests within your community." />
    <Card><p className="ca-notice">Community listings record the community entity as rent recipient. Private owner listings remain managed by their recorded apartment owners and do not route rent to Community Admins.</p></Card>
    <Card title="Create community rental listing">
      <form className="ca-form" onSubmit={createListing}>
        <Select label="Apartment" required value={listingForm.apartmentId} onChange={(event) => setListingForm({ ...listingForm, apartmentId: event.target.value })}><option value="">Choose an apartment</option>{apartments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
        <Input label="Monthly rent" type="number" min="0.01" step="0.01" required value={listingForm.monthlyRent} onChange={(event) => setListingForm({ ...listingForm, monthlyRent: event.target.value })} />
        <Input label="Security deposit" type="number" min="0" step="0.01" required value={listingForm.securityDeposit} onChange={(event) => setListingForm({ ...listingForm, securityDeposit: event.target.value })} />
        <Input label="Available from" type="date" required value={listingForm.availableFrom} onChange={(event) => setListingForm({ ...listingForm, availableFrom: event.target.value })} />
        <Textarea label="Rental details" rows="3" value={listingForm.details} onChange={(event) => setListingForm({ ...listingForm, details: event.target.value })} />
        <Button type="submit" loading={saving}>Create draft</Button>
      </form>
    </Card>
    <Card title="Community listings" flush>{data.listings.length ? <DataTable rows={data.listings} columns={listingColumns} /> : <EmptyState title="No rental listings" message="Create a community-managed listing to begin." />}</Card>
    {editing && <Card title={`Edit listing · ${apartmentText(editing, data)}`}><form className="ca-form" onSubmit={saveListing}><Input label="Monthly rent" type="number" min="0.01" step="0.01" required value={editing.monthlyRent} onChange={(event) => setEditing({ ...editing, monthlyRent: event.target.value })} /><Input label="Security deposit" type="number" min="0" step="0.01" required value={editing.securityDeposit} onChange={(event) => setEditing({ ...editing, securityDeposit: event.target.value })} /><Input label="Available from" type="date" required value={String(editing.availableFrom).slice(0,10)} onChange={(event) => setEditing({ ...editing, availableFrom: event.target.value })} /><Textarea label="Rental details" rows="3" value={editing.details || ""} onChange={(event) => setEditing({ ...editing, details: event.target.value })} /><div className="ca-actions"><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={saving}>Save listing</Button></div></form></Card>}
    <Card title="Create lease">
      <form className="ca-form" onSubmit={createLease}>
        <Select label="Available listing" required value={leaseForm.listingId} onChange={(event) => setLeaseForm({ ...leaseForm, listingId: event.target.value, tenantId: "" })}><option value="">Choose a listing</option>{availableListings.map((item) => <option key={item.id} value={item.id}>{apartmentText(item, data)} · {money(item.monthlyRent)}</option>)}</Select>
        <Select label="Resident tenant" required value={leaseForm.tenantId} disabled={!leaseForm.listingId} onChange={(event) => setLeaseForm({ ...leaseForm, tenantId: event.target.value })}><option value="">Choose a resident</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.email}</option>)}</Select>
        <Input label="Lease start" type="date" required value={leaseForm.startDate} onChange={(event) => setLeaseForm({ ...leaseForm, startDate: event.target.value })} />
        <Input label="Lease end" type="date" required value={leaseForm.endDate} onChange={(event) => setLeaseForm({ ...leaseForm, endDate: event.target.value })} />
        <Input label="Monthly due day (clamped to month end)" type="number" min="1" max="31" required value={leaseForm.dueDay} onChange={(event) => setLeaseForm({ ...leaseForm, dueDay: event.target.value })} />
        <Select label="Agreed rent escalation" value={leaseForm.escalationMethod} onChange={(event) => setLeaseForm({ ...leaseForm, escalationMethod: event.target.value })}><option value="NONE">No automatic increase</option><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></Select>
        {leaseForm.escalationMethod !== "NONE" && <><Input label={leaseForm.escalationMethod === "PERCENTAGE" ? "Increase percentage" : "Increase amount (INR)"} type="number" min={leaseForm.escalationMethod === "PERCENTAGE" ? "0" : "0.01"} max={leaseForm.escalationMethod === "PERCENTAGE" ? "1000" : "100000000"} step="0.01" required value={leaseForm.escalationValue} onChange={(event) => setLeaseForm({ ...leaseForm, escalationValue: event.target.value })} /><Input label="First effective month" type="date" required value={leaseForm.escalationDate} onChange={(event) => setLeaseForm({ ...leaseForm, escalationDate: event.target.value })} /><Input label="Interval (months)" type="number" min="1" max="120" required value={leaseForm.escalationInterval} onChange={(event) => setLeaseForm({ ...leaseForm, escalationInterval: event.target.value })} /><p className="ca-muted">The increase must start on the first day of a month during the lease. The tenant accepts these terms with the lease.</p></>}
        <Button type="submit" loading={saving} disabled={!availableListings.length}>Propose lease</Button>
      </form>
      <p className="ca-muted">The tenant must accept the agreed terms before you can activate the lease.</p>
    </Card>
    <Card title="Community leases" flush>{data.leases.length ? <DataTable rows={data.leases} columns={leaseColumns} /> : <EmptyState title="No rental leases" message="Leases for community-managed listings will appear here." />}</Card>
    {data.leases.map((lease) => <Card key={lease.id} title={`${apartmentText(lease, data)} · ${lease.tenant?.name || "Tenant"}`}>
      <p className="ca-muted">{lease.status} · Current monthly rent {money(lease.currentMonthlyRent ?? lease.monthlyRent)} · Due day {lease.dueDay} · Lease expiry {date(lease.endDate)}{lease.reminders?.leaseExpiry ? " · Expiry reminder due soon" : ""}</p>
      {lease.nextRentIncrease && <p className="ca-muted">Scheduled rent: {money(lease.nextRentIncrease.amount)} from {date(lease.nextRentIncrease.date)}.</p>}
      {lease.status === "ACTIVE" && <Button variant="secondary" onClick={() => setAmendment({ leaseId: lease.id, monthlyRent: lease.currentMonthlyRent ?? lease.monthlyRent, effectiveDate: "", reason: "" })}>Propose rent amendment</Button>}
      {amendment?.leaseId === lease.id && <form className="ca-form" onSubmit={submitAmendment}><Input label="Proposed monthly rent" type="number" min="0.01" step="0.01" required value={amendment.monthlyRent} onChange={(event) => setAmendment({ ...amendment, monthlyRent: event.target.value })} /><Input label="Effective first day of month" type="date" required value={amendment.effectiveDate} onChange={(event) => setAmendment({ ...amendment, effectiveDate: event.target.value })} /><Input label="Reason" required value={amendment.reason} onChange={(event) => setAmendment({ ...amendment, reason: event.target.value })} /><Button type="submit" loading={saving}>Send for tenant decision</Button><Button variant="secondary" onClick={() => setAmendment(null)}>Cancel</Button></form>}
      <DataTable rows={lease.amendments || []} columns={[{ key: "effectiveDate", header: "Amendment effective", render: date }, { key: "reason", header: "Reason" }, { key: "terms", header: "Terms", render: (terms) => terms.monthlyRent === undefined ? "Other lease terms" : `${money(terms.monthlyRent)} monthly rent` }, { key: "status", header: "Tenant decision" }, { key: "actions", header: "Action", render: (_, item) => item.status === "PENDING_TENANT_ACCEPTANCE" ? <Button variant="secondary" onClick={() => act(() => communityAdminService.withdrawRentAmendment(item.id), "Pending amendment withdrawn.")}>Withdraw</Button> : "—" }]} emptyTitle="No rent amendments" />
      {lease.status === "PENDING_APPROVAL" && <Button disabled={!lease.tenantAccepted} onClick={() => act(() => communityAdminService.activateRentalLease(lease.id), "Lease activated.")}>{lease.tenantAccepted ? "Activate accepted lease" : "Waiting for tenant acceptance"}</Button>}
      {!!lease.reminders?.upcomingRent?.length && <p className="ca-muted">Rent due within seven days: {lease.reminders.upcomingRent.map((item) => `${date(item.dueDate)} (${money(item.outstandingBalance)})`).join(", ")}</p>}
      {!!lease.reminders?.overdueRent?.length && <p className="ca-muted">Overdue rent obligations: {lease.reminders.overdueRent.length}</p>}
      <DataTable rows={lease.obligations || []} columns={[{ key: "billingPeriod", header: "Period" }, { key: "dueDate", header: "Due", render: date }, { key: "amountDue", header: "Amount", render: money }, { key: "outstandingBalance", header: "Outstanding", render: money }, { key: "status", header: "Status" }]} emptyTitle="No rent obligations" />
      <h3>Payment evidence</h3><DataTable rows={lease.payments || []} columns={[{ key: "transactionReference", header: "Reference" }, { key: "amount", header: "Amount", render: money }, { key: "status", header: "Status" }, { key: "actions", header: "Review", render: (_, payment) => payment.status === "PENDING_VERIFICATION" ? <div className="ca-actions"><Button onClick={() => act(() => communityAdminService.reviewRentalPayment(payment.id, "VERIFIED"), "Payment evidence verified.")}>Verify</Button><Button variant="danger" onClick={() => act(() => communityAdminService.reviewRentalPayment(payment.id, "REJECTED"), "Payment evidence rejected.")}>Reject</Button></div> : payment.status === "VERIFIED" ? <Button variant="secondary" onClick={() => setRentRefund({ ...rentRefund, paymentId: payment.id })}>Record refund</Button> : "—" }]} emptyTitle="No payment records" />
      {rentRefund.paymentId && lease.payments.some((payment) => payment.id === rentRefund.paymentId) && <form className="ca-form" onSubmit={submitRentRefund}><Input label="Refund amount" type="number" min="0.01" step="0.01" required value={rentRefund.amount} onChange={(event) => setRentRefund({ ...rentRefund, amount: event.target.value })} /><Input label="Reason" required value={rentRefund.reason} onChange={(event) => setRentRefund({ ...rentRefund, reason: event.target.value })} /><Input label="Refund reference" required value={rentRefund.transactionReference} onChange={(event) => setRentRefund({ ...rentRefund, transactionReference: event.target.value })} /><Button type="submit" loading={saving}>Record rent refund</Button></form>}
      <DataTable rows={lease.refunds || []} columns={[{ key: "transactionReference", header: "Refund reference" }, { key: "amount", header: "Amount", render: money }, { key: "reason", header: "Reason" }, { key: "status", header: "Status" }]} emptyTitle="No rent refunds" />
      <h3>Deposit record</h3><p>{money(lease.deposit?.collected)} collected · {money(lease.deposit?.deductions)} deducted · {money(lease.deposit?.refunded)} refunded · {money(lease.deposit?.held)} held ({lease.deposit?.status})</p>
      <DataTable rows={lease.deposit?.history || []} columns={[{ key: "type", header: "Entry" }, { key: "amount", header: "Amount", render: money }, { key: "reason", header: "Reason" }, { key: "disputeReason", header: "Tenant dispute" }, { key: "status", header: "Status" }, { key: "actions", header: "Review", render: (_, entry) => entry.status === "PENDING_VERIFICATION" && entry.type === "COLLECTION" ? <div className="ca-actions"><Button onClick={() => act(() => communityAdminService.reviewRentalDeposit(entry.id, "VERIFIED"), "Deposit evidence verified.")}>Verify</Button><Button variant="danger" onClick={() => act(() => communityAdminService.reviewRentalDeposit(entry.id, "REJECTED"), "Deposit evidence rejected.")}>Reject</Button></div> : entry.type === "DEDUCTION" && entry.status === "DISPUTED" ? <div className="ca-actions"><Button onClick={() => setResolution({ entryId: entry.id, decision: "VERIFIED", reason: "" })}>Resolve as accepted</Button><Button variant="secondary" onClick={() => setResolution({ entryId: entry.id, decision: "REJECTED", reason: "" })}>Reject deduction</Button></div> : "—" }]} emptyTitle="No deposit activity" />
      {resolution && lease.deposit?.history.some((entry) => entry.id === resolution.entryId) && <form className="ca-form" onSubmit={submitResolution}><Input label="Resolution reason" required value={resolution.reason} onChange={(event) => setResolution({ ...resolution, reason: event.target.value })} /><Button type="submit" loading={saving}>Save dispute resolution</Button></form>}
      {lease.status !== "ACTIVE" && <form className="ca-form ca-rentals__adjustment" onSubmit={submitAdjustment}><Select label="Deposit action" value={adjustment.leaseId === lease.id ? adjustment.type : "DEDUCTION"} onChange={(event) => setAdjustment({ ...adjustment, leaseId: lease.id, type: event.target.value })}><option value="DEDUCTION">Record deduction</option><option value="REFUND">Record refund</option></Select><Input label="Amount" type="number" min="0.01" step="0.01" required value={adjustment.leaseId === lease.id ? adjustment.amount : ""} onChange={(event) => setAdjustment({ ...adjustment, leaseId: lease.id, amount: event.target.value })} /><Input label="Reason" required value={adjustment.leaseId === lease.id ? adjustment.reason : ""} onChange={(event) => setAdjustment({ ...adjustment, leaseId: lease.id, reason: event.target.value })} />{adjustment.type === "REFUND" && <Input label="Refund reference" required value={adjustment.leaseId === lease.id ? adjustment.transactionReference : ""} onChange={(event) => setAdjustment({ ...adjustment, leaseId: lease.id, transactionReference: event.target.value })} />}<Button type="submit" loading={saving}>Record deposit action</Button></form>}
      <h3>Tenant requests</h3>{(lease.requests || []).length ? lease.requests.map((request) => <div key={request.id}><p>{request.type} · {request.status}{request.successorLeaseId ? ` · successor lease ${request.successorLeaseId}` : ""}</p>{request.renewalTerms && <p className="ca-muted">Renewal terms: {money(request.renewalTerms.monthlyRent)} monthly · deposit {money(request.renewalTerms.securityDeposit)} · due day {request.renewalTerms.dueDay} · {date(request.renewalTerms.startDate)} to {date(request.renewalTerms.endDate)}{request.renewalTerms.escalation ? ` · ${request.renewalTerms.escalation.method} escalation` : " · no inherited escalation"}</p>}{request.status === "PENDING" && <span className="ca-actions"><Button onClick={() => act(() => communityAdminService.decideRentalRequest(request.id, "APPROVED"), "Tenant request approved.")}>Approve</Button><Button variant="danger" onClick={() => act(() => communityAdminService.decideRentalRequest(request.id, "DECLINED"), "Tenant request declined.")}>Decline</Button></span>}</div>) : <p className="ca-muted">No lease requests.</p>}
    </Card>)}
    <Card><p className="ca-notice">Due and expiry indicators are generated when a rental view is loaded. They are displayed in Urbanity; no scheduled delivery or push/email reminders are configured.</p></Card>
  </div>;
}
