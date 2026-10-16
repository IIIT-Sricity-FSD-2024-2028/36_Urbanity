import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, Select, Textarea, useToast } from "../../../components/ui/index.js";
import { DataTable } from "../../../components/data-display/DataTable.jsx";
import { PageHeader } from "../../../components/data-display/PageHeader.jsx";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";

const money = (amount) => new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(Number(amount || 0));
const formatDate = (value) => {
  if (!value) return "Not available";
  const dateOnlyValue = /^\d{4}-\d{2}-\d{2}$/.test(value) || /T23:59:59\.999Z$/.test(value) ? value.slice(0, 10) : null;
  const parsed = dateOnlyValue ? new Date(`${dateOnlyValue}T12:00:00`) : new Date(value);
  return parsed.toLocaleDateString();
};
const apartmentText = (item) => item.label || item.apartmentNumber || item.id;
const listingColumns = [
  { key: "apartmentNumber", header: "Apartment", render: (value, row) => value || row.apartmentLabel || row.apartmentId },
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
  const [depositForm, setDepositForm] = useState({ amount: "", transactionReference: "" });
  const [renewal, setRenewal] = useState({ startDate: "", endDate: "", monthlyRent: lease.currentMonthlyRent ?? lease.monthlyRent, securityDeposit: lease.securityDeposit, dueDay: lease.dueDay, escalationMethod: "NONE", escalationValue: "", escalationDate: "", escalationInterval: "12" });
  const [disputeReason, setDisputeReason] = useState("");
  const request = async (type, terms) => {
    try {
      await residentService.requestLeaseChange(lease.id, type, terms);
      showToast({ type: "success", message: `${type === "RENEWAL" ? "Renewal" : "Termination"} request submitted.` });
      await onRefresh();
    } catch (error) { showToast({ type: "error", message: error.message || "Unable to submit lease request." }); }
  };
  const submitDepositEvidence = async (event) => {
    event.preventDefault();
    try {
      await residentService.submitDepositEvidence(lease.id, { amount: Number(depositForm.amount), transactionReference: depositForm.transactionReference });
      showToast({ type: "success", message: "Deposit evidence recorded for recipient review." });
      setDepositForm({ amount: "", transactionReference: "" }); await onRefresh();
    } catch (error) { showToast({ type: "error", message: error.message || "Unable to record deposit evidence." }); }
  };
  const acceptTerms = async () => {
    try { await residentService.acceptRentalLease(lease.id); showToast({ type: "success", message: "Lease terms accepted. The landlord must activate the lease." }); await onRefresh(); }
    catch (error) { showToast({ type: "error", message: error.message || "Unable to accept lease terms." }); }
  };
  const submitEvidence = async (event, obligation) => {
    event.preventDefault();
    const form = paymentForms[obligation.id] || {};
    try {
      await residentService.submitPaymentEvidence(lease.id, obligation.id, { amount: Number(form.amount), transactionReference: form.transactionReference });
      showToast({ type: "success", message: "Payment evidence recorded for recipient review." });
      setPaymentForms((current) => ({ ...current, [obligation.id]: { amount: "", transactionReference: "" } }));
      await onRefresh();
    } catch (error) { showToast({ type: "error", message: error.message || "Unable to record payment evidence." }); }
  };
  return <Card title={`Lease · ${lease.status}`}>
    <dl className="resident-facts">
      <div><dt>Current monthly rent</dt><dd>{money(lease.currentMonthlyRent ?? lease.monthlyRent)}</dd></div>
      {lease.nextRentIncrease && <div><dt>Scheduled rent increase</dt><dd>{money(lease.nextRentIncrease.amount)} from {formatDate(lease.nextRentIncrease.date)}</dd></div>}
      {lease.escalation && <div><dt>Agreed escalation</dt><dd>{lease.escalation.method === "PERCENTAGE" ? `${lease.escalation.value}%` : money(lease.escalation.value)} every {lease.escalation.intervalMonths} months</dd></div>}
      <div><dt>Security deposit</dt><dd>{money(lease.securityDeposit)} agreed · {money(lease.deposit?.collected)} collected</dd></div>
      <div><dt>Deposit status</dt><dd>{lease.deposit?.status}; {money(lease.deposit?.held)} held, {money(lease.deposit?.deductions)} deducted, {money(lease.deposit?.refunded)} refunded</dd></div>
      <div><dt>Start date</dt><dd>{formatDate(lease.startDate)}</dd></div>
      <div><dt>End date</dt><dd>{formatDate(lease.endDate)}</dd></div>
      <div><dt>Rent due</dt><dd>Day {lease.dueDay} of each month</dd></div>
      <div><dt>Rent recipient</dt><dd>{lease.arrangement === "COMMUNITY" ? "Community" : "Original lease recipient"}</dd></div>
    </dl>
    <div className="resident-rentals__table"><h3>Rent obligations</h3><DataTable rows={lease.obligations || []} columns={obligationColumns} emptyTitle="No rent obligations" /></div>
    {lease.obligations?.some((item) => item.amountPaid < item.amountDue) && <div className="resident-rentals__table"><h3>Record payment evidence</h3><p className="resident-muted">This records a payment reference for manual review. It does not transfer money or verify a payment.</p>{lease.obligations.filter((item) => item.amountPaid < item.amountDue).map((item) => <form className="resident-rentals__payment" key={item.id} onSubmit={(event) => submitEvidence(event, item)}><strong>{item.billingPeriod} · balance {money(item.amountDue - item.amountPaid)}</strong><Input label="Amount" type="number" min="0.01" step="0.01" required value={paymentForms[item.id]?.amount || ""} onChange={(event) => setPaymentForms((current) => ({ ...current, [item.id]: { ...current[item.id], amount: event.target.value } }))} /><Input label="Transaction reference" maxLength={120} required value={paymentForms[item.id]?.transactionReference || ""} onChange={(event) => setPaymentForms((current) => ({ ...current, [item.id]: { ...current[item.id], transactionReference: event.target.value } }))} /><Button type="submit">Record evidence</Button></form>)}</div>}
    <div className="resident-rentals__table"><h3>Payment records</h3><DataTable rows={lease.payments || []} columns={[{ key: "transactionReference", header: "Reference" }, { key: "amount", header: "Amount", render: money }, { key: "createdAt", header: "Recorded", render: formatDate }, { key: "status", header: "Status" }]} emptyTitle="No payment records" /></div>
    <div className="resident-rentals__table"><h3>Rent refund history</h3><DataTable rows={lease.refunds || []} columns={[{ key: "transactionReference", header: "Refund reference" }, { key: "amount", header: "Amount", render: money }, { key: "reason", header: "Reason" }, { key: "status", header: "Status" }, { key: "actions", header: "Action", render: (_, refund) => refund.status === "PENDING_TENANT_CONFIRMATION" ? <div className="resident-actions"><Button onClick={async () => { try { await residentService.reviewRentalRefund(refund.id, "VERIFIED"); showToast({ type: "success", message: "Rent refund confirmed." }); await onRefresh(); } catch (error) { showToast({ type: "error", message: error.message }); } }}>Confirm</Button><Button variant="secondary" onClick={async () => { try { await residentService.reviewRentalRefund(refund.id, "REJECTED"); showToast({ type: "success", message: "Rent refund evidence rejected." }); await onRefresh(); } catch (error) { showToast({ type: "error", message: error.message }); } }}>Reject</Button></div> : "—" }]} emptyTitle="No rent refunds" /></div>
    <div className="resident-rentals__table"><h3>Deposit history</h3><DataTable rows={lease.deposit?.history || []} columns={[{ key: "type", header: "Entry" }, { key: "amount", header: "Amount", render: money }, { key: "reason", header: "Reason" }, { key: "disputeReason", header: "Tenant decision / dispute" }, { key: "status", header: "Status" }, { key: "actions", header: "Action", render: (_, entry) => entry.status === "PENDING_VERIFICATION" && entry.type === "REFUND" ? <div className="resident-actions"><Button onClick={async () => { try { await residentService.reviewDeposit(entry.id, "VERIFIED"); showToast({ type: "success", message: "Refund confirmed." }); await onRefresh(); } catch (error) { showToast({ type: "error", message: error.message }); } }}>Confirm refund</Button><Button variant="danger" onClick={async () => { try { await residentService.reviewDeposit(entry.id, "REJECTED"); showToast({ type: "success", message: "Refund evidence rejected." }); await onRefresh(); } catch (error) { showToast({ type: "error", message: error.message }); } }}>Reject</Button></div> : entry.type === "DEDUCTION" && entry.status === "PENDING_TENANT_CONFIRMATION" ? <div className="resident-actions"><Button onClick={async () => { try { await residentService.decideDepositDeduction(entry.id, "ACCEPTED"); showToast({ type: "success", message: "Deposit deduction accepted." }); await onRefresh(); } catch (error) { showToast({ type: "error", message: error.message }); } }}>Accept</Button><Button variant="secondary" onClick={async () => { if (!disputeReason.trim()) return; try { await residentService.decideDepositDeduction(entry.id, "DISPUTED", disputeReason); setDisputeReason(""); showToast({ type: "success", message: "Deposit deduction disputed." }); await onRefresh(); } catch (error) { showToast({ type: "error", message: error.message }); } }}>Dispute</Button><Input label="Dispute reason" required value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} /></div> : "—" }]} emptyTitle="No deposit history" /></div>
    {lease.status === "ACTIVE" && lease.securityDeposit > lease.deposit?.collected && <form className="resident-rentals__payment" onSubmit={submitDepositEvidence}><strong>Record deposit collection evidence</strong><Input label="Amount" type="number" min="0.01" step="0.01" required value={depositForm.amount} onChange={(event) => setDepositForm({ ...depositForm, amount: event.target.value })} /><Input label="Transaction reference" maxLength={120} required value={depositForm.transactionReference} onChange={(event) => setDepositForm({ ...depositForm, transactionReference: event.target.value })} /><Button type="submit">Record deposit evidence</Button></form>}
    {lease.reminders?.leaseExpiry && <p className="resident-muted">Lease expiry is approaching: {formatDate(lease.reminders.leaseExpiry)}.</p>}
    {!!lease.reminders?.upcomingRent?.length && <p className="resident-muted">Rent due soon: {lease.reminders.upcomingRent.map((item) => formatDate(item.dueDate)).join(", ")}.</p>}
    {!!lease.reminders?.overdueRent?.length && <p className="resident-muted">Overdue rent: {lease.reminders.overdueRent.length} obligation(s) have a balance.</p>}
    {lease.status === "ACTIVE" && <div className="resident-actions"><Button variant="secondary" onClick={() => request("RENEWAL")}>Request renewal</Button><Button variant="secondary" onClick={() => request("TERMINATION")}>Request termination</Button></div>}
    {lease.status === "ACTIVE" && <form className="resident-rentals__payment" onSubmit={(event) => { event.preventDefault(); const { escalationMethod, escalationValue, escalationDate, escalationInterval, ...terms } = renewal; const escalation = escalationMethod === "NONE" ? undefined : { method: escalationMethod, value: Number(escalationValue), effectiveDate: escalationDate, intervalMonths: Number(escalationInterval) }; request("RENEWAL", { ...terms, monthlyRent: Number(terms.monthlyRent), securityDeposit: Number(terms.securityDeposit), dueDay: Number(terms.dueDay), ...(escalation ? { escalation } : {}) }); }}><strong>Propose renewal terms</strong><Input label="New start date" type="date" required value={renewal.startDate} onChange={(event) => setRenewal({ ...renewal, startDate: event.target.value })} /><Input label="New end date" type="date" required value={renewal.endDate} onChange={(event) => setRenewal({ ...renewal, endDate: event.target.value })} /><Input label="Monthly rent" type="number" min="0.01" step="0.01" required value={renewal.monthlyRent} onChange={(event) => setRenewal({ ...renewal, monthlyRent: event.target.value })} /><Input label="Security deposit" type="number" min="0" step="0.01" required value={renewal.securityDeposit} onChange={(event) => setRenewal({ ...renewal, securityDeposit: event.target.value })} /><Input label="Rent due day" type="number" min="1" max="31" required value={renewal.dueDay} onChange={(event) => setRenewal({ ...renewal, dueDay: event.target.value })} /><Select label="New escalation schedule" value={renewal.escalationMethod} onChange={(event) => setRenewal({ ...renewal, escalationMethod: event.target.value })}><option value="NONE">No escalation</option><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed increase</option></Select>{renewal.escalationMethod !== "NONE" && <><Input label="Increase value" type="number" min="0.01" step="0.01" required value={renewal.escalationValue} onChange={(event) => setRenewal({ ...renewal, escalationValue: event.target.value })} /><Input label="First effective month" type="date" required value={renewal.escalationDate} onChange={(event) => setRenewal({ ...renewal, escalationDate: event.target.value })} /><Input label="Interval in months" type="number" min="1" max="120" required value={renewal.escalationInterval} onChange={(event) => setRenewal({ ...renewal, escalationInterval: event.target.value })} /></>}<Button type="submit">Submit renewal terms</Button></form>}
    <div className="resident-rentals__table"><h3>Rent amendment proposals</h3><DataTable rows={lease.amendments || []} columns={[{ key: "effectiveDate", header: "Effective", render: formatDate }, { key: "reason", header: "Reason" }, { key: "terms", header: "Proposed terms", render: (terms) => [terms.monthlyRent !== undefined ? `${money(terms.monthlyRent)} monthly rent` : null, terms.dueDay ? `due day ${terms.dueDay}` : null].filter(Boolean).join(" · ") }, { key: "status", header: "Status" }, { key: "actions", header: "Decision", render: (_, item) => item.status === "PENDING_TENANT_ACCEPTANCE" ? <div className="resident-actions"><Button onClick={async () => { try { await residentService.decideRentAmendment(item.id, "ACCEPTED"); showToast({ type: "success", message: "Rent amendment accepted." }); await onRefresh(); } catch (error) { showToast({ type: "error", message: error.message }); } }}>Accept</Button><Button variant="secondary" onClick={async () => { try { await residentService.decideRentAmendment(item.id, "REJECTED"); showToast({ type: "success", message: "Rent amendment rejected." }); await onRefresh(); } catch (error) { showToast({ type: "error", message: error.message }); } }}>Reject</Button></div> : "—" }]} emptyTitle="No rent amendments" /></div>
    {lease.status === "PENDING_APPROVAL" && <Button onClick={acceptTerms} disabled={lease.tenantAccepted}>{lease.tenantAccepted ? "Terms accepted · awaiting landlord activation" : "Accept lease terms"}</Button>}
    {(lease.requests || []).map((item) => <p key={item.id} className="resident-muted">{item.type} request: {item.status}{item.successorLeaseId ? ` · successor ${item.successorLeaseId}` : ""}{item.type === "RENEWAL" && item.renewalTerms ? ` · ${money(item.renewalTerms.monthlyRent)} monthly, deposit ${money(item.renewalTerms.securityDeposit)}, due day ${item.renewalTerms.dueDay}, ${formatDate(item.renewalTerms.startDate)}–${formatDate(item.renewalTerms.endDate)}` : ""}{item.status === "PENDING" && <Button variant="secondary" onClick={async () => { try { await residentService.withdrawRentalRequest(item.id); showToast({ type: "success", message: "Lease request withdrawn." }); await onRefresh(); } catch (error) { showToast({ type: "error", message: error.message }); } }}>Withdraw request</Button>}</p>)}
  </Card>;
}

function OwnerManagement({ data, onRefresh }) {
  const { showToast } = useToast();
  const [listingForm, setListingForm] = useState({ apartmentId: "", monthlyRent: "", securityDeposit: "", availableFrom: "", details: "" });
  const [leaseForm, setLeaseForm] = useState({ listingId: "", tenantId: "", startDate: "", endDate: "", dueDay: "1", escalationMethod: "NONE", escalationValue: "", escalationDate: "", escalationInterval: "12" });
  const [depositForm, setDepositForm] = useState({ leaseId: "", type: "DEDUCTION", amount: "", reason: "", transactionReference: "" });
  const [refundForm, setRefundForm] = useState({ paymentId: "", amount: "", reason: "", transactionReference: "" });
  const [amendmentForm, setAmendmentForm] = useState(null);
  const [disputeResolution, setDisputeResolution] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const owned = data.ownedApartments || [];
  const listings = data.managedListings || [];
  const leases = data.managedLeases || [];
  useEffect(() => {
    if (!leaseForm.listingId) { setTenants([]); return; }
    let active = true;
    residentService.getRentalTenants(leaseForm.listingId).then((items) => { if (active) setTenants(items); }).catch((error) => { if (active) showToast({ type: "error", message: error.message }); });
    return () => { active = false; };
  }, [leaseForm.listingId, showToast]);
  const act = async (operation, message) => {
    setSaving(true); try { await operation(); showToast({ type: "success", message }); await onRefresh(); }
    catch (error) { showToast({ type: "error", message: error.message || "Rental operation failed." }); }
    finally { setSaving(false); }
  };
  const createListing = (event) => {
    event.preventDefault();
    act(() => residentService.createRentalListing({ ...listingForm, monthlyRent: Number(listingForm.monthlyRent), securityDeposit: Number(listingForm.securityDeposit), arrangement: "OWNER" }), "Private rental listing created as a draft.");
    setListingForm({ apartmentId: "", monthlyRent: "", securityDeposit: "", availableFrom: "", details: "" });
  };
  const createLease = (event) => {
    event.preventDefault();
    const { escalationMethod, escalationValue, escalationDate, escalationInterval, ...terms } = leaseForm;
    const escalation = escalationMethod === "NONE" ? undefined : { method: escalationMethod, value: Number(escalationValue), effectiveDate: escalationDate, intervalMonths: Number(escalationInterval) };
    act(() => residentService.createRentalLease({ ...terms, dueDay: Number(leaseForm.dueDay), ...(escalation ? { escalation } : {}) }), "Lease proposal created.");
    setLeaseForm((current) => ({ ...current, tenantId: "", startDate: "", endDate: "" }));
  };
  const submitDepositAdjustment = (event) => {
    event.preventDefault();
    const payload = { amount: Number(depositForm.amount), reason: depositForm.reason, ...(depositForm.type === "REFUND" ? { transactionReference: depositForm.transactionReference } : {}) };
    act(() => depositForm.type === "REFUND" ? residentService.createDepositRefund(depositForm.leaseId, payload) : residentService.createDepositDeduction(depositForm.leaseId, payload), depositForm.type === "REFUND" ? "Deposit refund recorded for tenant confirmation." : "Deposit deduction recorded.");
    setDepositForm({ leaseId: "", type: "DEDUCTION", amount: "", reason: "", transactionReference: "" });
  };
  const submitRefund = (event) => {
    event.preventDefault();
    act(() => residentService.recordRentalRefund(refundForm.paymentId, { amount: Number(refundForm.amount), reason: refundForm.reason, transactionReference: refundForm.transactionReference }), "Refund recorded for tenant confirmation.");
    setRefundForm({ paymentId: "", amount: "", reason: "", transactionReference: "" });
  };
  const submitAmendment = (event) => { event.preventDefault(); const { leaseId, monthlyRent, effectiveDate, reason } = amendmentForm; act(() => residentService.proposeRentAmendment(leaseId, { monthlyRent: Number(monthlyRent), effectiveDate, reason }), "Amendment sent to the tenant for a decision."); setAmendmentForm(null); };
  const resolveDispute = (event) => { event.preventDefault(); act(() => residentService.resolveDepositDispute(disputeResolution.entryId, disputeResolution.decision, disputeResolution.reason), `Disputed deduction ${disputeResolution.decision.toLowerCase()}.`); setDisputeResolution(null); };
  const saveListing = (event) => {
    event.preventDefault();
    act(() => residentService.updateRentalListing(editingListing.id, { monthlyRent: Number(editingListing.monthlyRent), securityDeposit: Number(editingListing.securityDeposit), availableFrom: editingListing.availableFrom, details: editingListing.details }), "Private listing updated.");
    setEditingListing(null);
  };
  if (!owned.length && !listings.length && !leases.length) return null;
  return <section className="resident-stack" aria-label="Owner rental management">
    <h2 className="resident-rentals__heading">My rental properties</h2>
    {!!owned.length && <Card title="Create private listing"><form className="resident-rentals__payment" onSubmit={createListing}>
      <Select label="Owned apartment" required value={listingForm.apartmentId} onChange={(event) => setListingForm({ ...listingForm, apartmentId: event.target.value })}><option value="">Choose apartment</option>{owned.map((item) => <option key={item.id} value={item.id}>{apartmentText(item)}</option>)}</Select>
      <Input label="Monthly rent" type="number" min="0.01" step="0.01" required value={listingForm.monthlyRent} onChange={(event) => setListingForm({ ...listingForm, monthlyRent: event.target.value })} />
      <Input label="Security deposit" type="number" min="0" step="0.01" required value={listingForm.securityDeposit} onChange={(event) => setListingForm({ ...listingForm, securityDeposit: event.target.value })} />
      <Input label="Available from" type="date" required value={listingForm.availableFrom} onChange={(event) => setListingForm({ ...listingForm, availableFrom: event.target.value })} />
      <Textarea label="Details" rows="2" value={listingForm.details} onChange={(event) => setListingForm({ ...listingForm, details: event.target.value })} />
      <Button type="submit" loading={saving}>Create draft</Button>
    </form></Card>}
    <Card title="My listings" flush>{listings.length ? <DataTable rows={listings} columns={[{ key: "apartmentId", header: "Apartment", render: (value) => owned.find((item) => item.id === value)?.label || value }, { key: "monthlyRent", header: "Monthly rent", render: money }, { key: "availableFrom", header: "Available", render: formatDate }, { key: "status", header: "Status" }, { key: "actions", header: "Actions", render: (_, row) => row.status !== "RENTED" ? <div className="resident-actions"><Button variant="secondary" onClick={() => setEditingListing({ ...row })}>Edit</Button>{row.status !== "AVAILABLE" && <Button onClick={() => act(() => residentService.updateRentalListing(row.id, { status: "AVAILABLE" }), "Listing published.")}>Publish</Button>}{row.status === "AVAILABLE" && <Button variant="secondary" onClick={() => act(() => residentService.updateRentalListing(row.id, { status: "WITHDRAWN" }), "Listing withdrawn.")}>Withdraw</Button>}</div> : "Leased" }]} /> : <EmptyState title="No private listings" message="Create a listing for an apartment recorded under your ownership." />}</Card>
    {editingListing && <Card title="Edit private listing"><form className="resident-rentals__payment" onSubmit={saveListing}><Input label="Monthly rent" type="number" min="0.01" step="0.01" required value={editingListing.monthlyRent} onChange={(event) => setEditingListing({ ...editingListing, monthlyRent: event.target.value })} /><Input label="Security deposit" type="number" min="0" step="0.01" required value={editingListing.securityDeposit} onChange={(event) => setEditingListing({ ...editingListing, securityDeposit: event.target.value })} /><Input label="Available from" type="date" required value={String(editingListing.availableFrom).slice(0,10)} onChange={(event) => setEditingListing({ ...editingListing, availableFrom: event.target.value })} /><Textarea label="Details" rows="2" value={editingListing.details || ""} onChange={(event) => setEditingListing({ ...editingListing, details: event.target.value })} /><Button type="submit" loading={saving}>Save listing</Button><Button variant="secondary" onClick={() => setEditingListing(null)}>Cancel</Button></form></Card>}
    {!!listings.some((item) => item.status === "AVAILABLE") && <Card title="Create lease"><form className="resident-rentals__payment" onSubmit={createLease}>
      <Select label="Listing" required value={leaseForm.listingId} onChange={(event) => setLeaseForm({ ...leaseForm, listingId: event.target.value, tenantId: "" })}><option value="">Choose a listing</option>{listings.filter((item) => item.status === "AVAILABLE").map((item) => <option key={item.id} value={item.id}>{owned.find((a) => a.id === item.apartmentId)?.label || item.apartmentId} · {money(item.monthlyRent)}</option>)}</Select>
      <Select label="Tenant" required value={leaseForm.tenantId} disabled={!leaseForm.listingId} onChange={(event) => setLeaseForm({ ...leaseForm, tenantId: event.target.value })}><option value="">Choose resident</option>{tenants.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</Select>
      <Input label="Start date" type="date" required value={leaseForm.startDate} onChange={(event) => setLeaseForm({ ...leaseForm, startDate: event.target.value })} />
      <Input label="End date" type="date" required value={leaseForm.endDate} onChange={(event) => setLeaseForm({ ...leaseForm, endDate: event.target.value })} />
      <Input label="Rent due day (clamped to month end)" type="number" min="1" max="31" required value={leaseForm.dueDay} onChange={(event) => setLeaseForm({ ...leaseForm, dueDay: event.target.value })} />
      <Select label="Agreed rent escalation" value={leaseForm.escalationMethod} onChange={(event) => setLeaseForm({ ...leaseForm, escalationMethod: event.target.value })}><option value="NONE">No automatic increase</option><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></Select>
      {leaseForm.escalationMethod !== "NONE" && <><Input label={leaseForm.escalationMethod === "PERCENTAGE" ? "Increase percentage" : "Increase amount (INR)"} type="number" min={leaseForm.escalationMethod === "PERCENTAGE" ? "0" : "0.01"} max={leaseForm.escalationMethod === "PERCENTAGE" ? "1000" : "100000000"} step="0.01" required value={leaseForm.escalationValue} onChange={(event) => setLeaseForm({ ...leaseForm, escalationValue: event.target.value })} /><Input label="First effective month" type="date" required value={leaseForm.escalationDate} onChange={(event) => setLeaseForm({ ...leaseForm, escalationDate: event.target.value })} /><Input label="Interval (months)" type="number" min="1" max="120" required value={leaseForm.escalationInterval} onChange={(event) => setLeaseForm({ ...leaseForm, escalationInterval: event.target.value })} /><p className="resident-muted">The increase must start on the first day of a month during the lease. The tenant accepts these terms with the lease.</p></>}
      <Button type="submit" loading={saving}>Propose lease</Button>
    </form><p className="resident-muted">The tenant must accept the agreed terms before you can activate the lease.</p></Card>}
    {leases.map((lease) => <Card key={lease.id} title={`Lease · ${lease.status} · ${lease.tenant?.name}`}><p>Current rent {money(lease.currentMonthlyRent ?? lease.monthlyRent)} · ends {formatDate(lease.endDate)} · tenant {lease.tenant?.name || "—"}</p>{lease.nextRentIncrease && <p className="resident-muted">Scheduled rent: {money(lease.nextRentIncrease.amount)} from {formatDate(lease.nextRentIncrease.date)}.</p>}{lease.status === "ACTIVE" && <Button variant="secondary" onClick={() => setAmendmentForm({ leaseId: lease.id, monthlyRent: lease.currentMonthlyRent ?? lease.monthlyRent, effectiveDate: "", reason: "" })}>Propose rent amendment</Button>}{amendmentForm?.leaseId === lease.id && <form className="resident-rentals__payment" onSubmit={submitAmendment}><Input label="Proposed monthly rent" type="number" min="0.01" step="0.01" required value={amendmentForm.monthlyRent} onChange={(event) => setAmendmentForm({ ...amendmentForm, monthlyRent: event.target.value })} /><Input label="Effective first day of month" type="date" required value={amendmentForm.effectiveDate} onChange={(event) => setAmendmentForm({ ...amendmentForm, effectiveDate: event.target.value })} /><Input label="Reason" required value={amendmentForm.reason} onChange={(event) => setAmendmentForm({ ...amendmentForm, reason: event.target.value })} /><Button type="submit" loading={saving}>Send to tenant</Button><Button variant="secondary" onClick={() => setAmendmentForm(null)}>Cancel</Button></form>}<DataTable rows={lease.amendments || []} columns={[{ key: "effectiveDate", header: "Effective", render: formatDate }, { key: "reason", header: "Reason" }, { key: "status", header: "Status" }, { key: "actions", header: "Action", render: (_, item) => item.status === "PENDING_TENANT_ACCEPTANCE" ? <Button variant="secondary" onClick={() => act(() => residentService.withdrawRentAmendment(item.id), "Pending amendment withdrawn.")}>Withdraw</Button> : "—" }]} emptyTitle="No amendments" />{lease.status === "PENDING_APPROVAL" && <Button disabled={!lease.tenantAccepted} onClick={() => act(() => residentService.activateRentalLease(lease.id), "Lease activated.")}>{lease.tenantAccepted ? "Activate accepted lease" : "Waiting for tenant acceptance"}</Button>}
      <DataTable rows={lease.obligations || []} columns={[{ key: "billingPeriod", header: "Period" }, { key: "dueDate", header: "Due", render: formatDate }, { key: "amountDue", header: "Due amount", render: money }, { key: "outstandingBalance", header: "Outstanding", render: money }, { key: "status", header: "Status" }]} emptyTitle="No rent obligations" />
      {!!lease.reminders?.upcomingRent?.length && <p className="resident-muted">Rent due soon: {lease.reminders.upcomingRent.map((item) => formatDate(item.dueDate)).join(", ")}.</p>}
      {lease.reminders?.leaseExpiry && <p className="resident-muted">Lease expiry approaching: {formatDate(lease.reminders.leaseExpiry)}.</p>}
      <DataTable rows={lease.payments || []} columns={[{ key: "transactionReference", header: "Reference" }, { key: "amount", header: "Amount", render: money }, { key: "status", header: "Status" }, { key: "actions", header: "Review", render: (_, item) => item.status === "PENDING_VERIFICATION" ? <div className="resident-actions"><Button onClick={() => act(() => residentService.reviewRentalPayment(item.id, "VERIFIED"), "Payment evidence verified.")}>Verify</Button><Button variant="secondary" onClick={() => act(() => residentService.reviewRentalPayment(item.id, "REJECTED"), "Payment evidence rejected.")}>Reject</Button></div> : item.status === "VERIFIED" ? <Button variant="secondary" onClick={() => setRefundForm({ ...refundForm, paymentId: item.id })}>Record refund</Button> : "—" }]} emptyTitle="No payment evidence" />
      {refundForm.paymentId && lease.payments.some((item) => item.id === refundForm.paymentId) && <form className="resident-rentals__payment" onSubmit={submitRefund}><Input label="Refund amount" type="number" min="0.01" step="0.01" required value={refundForm.amount} onChange={(event) => setRefundForm({ ...refundForm, amount: event.target.value })} /><Input label="Reason" required value={refundForm.reason} onChange={(event) => setRefundForm({ ...refundForm, reason: event.target.value })} /><Input label="Refund reference" required value={refundForm.transactionReference} onChange={(event) => setRefundForm({ ...refundForm, transactionReference: event.target.value })} /><Button type="submit" loading={saving}>Record refund</Button></form>}
      <DataTable rows={lease.refunds || []} columns={[{ key: "transactionReference", header: "Refund reference" }, { key: "amount", header: "Amount", render: money }, { key: "reason", header: "Reason" }, { key: "status", header: "Status" }]} emptyTitle="No rent refunds" />
      <h3>Deposit · {money(lease.deposit?.held)} held</h3><DataTable rows={lease.deposit?.history || []} columns={[{ key: "type", header: "Entry" }, { key: "amount", header: "Amount", render: money }, { key: "reason", header: "Reason" }, { key: "disputeReason", header: "Tenant dispute" }, { key: "status", header: "Status" }, { key: "actions", header: "Review", render: (_, item) => item.type === "COLLECTION" && item.status === "PENDING_VERIFICATION" ? <div className="resident-actions"><Button onClick={() => act(() => residentService.reviewDeposit(item.id, "VERIFIED"), "Deposit evidence verified.")}>Verify</Button><Button variant="secondary" onClick={() => act(() => residentService.reviewDeposit(item.id, "REJECTED"), "Deposit evidence rejected.")}>Reject</Button></div> : item.type === "DEDUCTION" && item.status === "DISPUTED" ? <div className="resident-actions"><Button onClick={() => setDisputeResolution({ entryId: item.id, decision: "VERIFIED", reason: "" })}>Resolve as accepted</Button><Button variant="secondary" onClick={() => setDisputeResolution({ entryId: item.id, decision: "REJECTED", reason: "" })}>Reject deduction</Button></div> : "—" }]} emptyTitle="No deposit activity" />
      {disputeResolution && lease.deposit?.history.some((item) => item.id === disputeResolution.entryId) && <form className="resident-rentals__payment" onSubmit={resolveDispute}><Input label="Resolution reason" required value={disputeResolution.reason} onChange={(event) => setDisputeResolution({ ...disputeResolution, reason: event.target.value })} /><Button type="submit" loading={saving}>Save resolution</Button></form>}
      {lease.status !== "ACTIVE" && <form className="resident-rentals__payment" onSubmit={submitDepositAdjustment}><Select label="Deposit action" value={depositForm.leaseId === lease.id ? depositForm.type : "DEDUCTION"} onChange={(event) => setDepositForm({ ...depositForm, leaseId: lease.id, type: event.target.value })}><option value="DEDUCTION">Record deduction</option><option value="REFUND">Record refund</option></Select><Input label="Amount" type="number" min="0.01" step="0.01" required value={depositForm.leaseId === lease.id ? depositForm.amount : ""} onChange={(event) => setDepositForm({ ...depositForm, leaseId: lease.id, amount: event.target.value })} /><Input label="Reason" required value={depositForm.leaseId === lease.id ? depositForm.reason : ""} onChange={(event) => setDepositForm({ ...depositForm, leaseId: lease.id, reason: event.target.value })} />{depositForm.type === "REFUND" && <Input label="Refund reference" required value={depositForm.leaseId === lease.id ? depositForm.transactionReference : ""} onChange={(event) => setDepositForm({ ...depositForm, leaseId: lease.id, transactionReference: event.target.value })} />}<Button type="submit" loading={saving}>Record deposit action</Button></form>}
      {(lease.requests || []).filter((item) => item.status === "PENDING").map((item) => <div className="resident-actions" key={item.id}><span>{item.type} request</span><Button onClick={() => act(() => residentService.decideRentalRequest(item.id, "APPROVED"), "Lease request approved.")}>Approve</Button><Button variant="secondary" onClick={() => act(() => residentService.decideRentalRequest(item.id, "DECLINED"), "Lease request declined.")}>Decline</Button></div>)}
      <p className="resident-muted">Rent recipient: you as the recorded apartment owner.</p>
    </Card>)}
  </section>;
}

export function RentalsPage() {
  const loader = useCallback(() => residentService.getRentals(), []);
  const { data, loading, error, reload } = useResidentResource(loader);
  return <div className="resident-stack resident-rentals">
    <PageHeader eyebrow="Resident services" title="Rentals & leases" description="Review rental availability, your lease terms, rent schedule, payment records, and deposit information." />
    {loading && <LoadingState message="Loading rental information…" />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <>
      <Card title="Available listings">
        <p className="resident-muted">Rental listings available in your community.</p>
        {data.listings?.length ? <div className="resident-rentals__table"><DataTable rows={data.listings} columns={listingColumns} emptyTitle="No available listings" /></div> : <EmptyState title="No available listings" message="There are no currently published rentals in your community." />}
      </Card>
      <OwnerManagement data={data} onRefresh={reload} />
      <section className="resident-stack" aria-label="My leases">
        <h2 className="resident-rentals__heading">My leases</h2>
        {data.leases?.length ? data.leases.map((lease) => <LeaseCard key={lease.id} lease={lease} onRefresh={reload} />) : <EmptyState title="No rental leases" message="Your lease information will appear here when a lease is created for you." />}
      </section>
      <p className="resident-muted">Payment and deposit references are records for manual review; they do not transfer money or verify a gateway transaction. Due and expiry dates are shown in Urbanity when available; no automatic reminders are delivered.</p>
    </>}
  </div>;
}
