import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { useAsyncResource } from "../../../hooks/useAsyncResource.js";
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, LoadingState, Modal, Select, Textarea, useToast } from "../../../components/ui/index.js";
import { DataTable, PageHeader, RatingStars, StatusBadge } from "../../../components/data-display/index.js";
import { paidServicesService as service } from "../services/paidServicesService.js";
import "../paid-services.css";

const workTypes = ["PLUMBING", "ELECTRICAL", "CARPENTRY", "HVAC", "LIFT_MAINTENANCE", "CLEANING", "GENERAL_MAINTENANCE"];
const money = (paise) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format((paise || 0) / 100);
const label = (value) => String(value || "").replaceAll("_", " ");
const date = (value) => value ? new Date(value).toLocaleString() : "Not scheduled";
const authorityRoles = ["COMMUNITY_ADMIN", "TOWER_REPRESENTATIVE"];
const asPaise = (value) => {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error("Enter an amount with at most two decimal places.");
  const [whole, decimal = ""] = String(value).split(".");
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000) throw new Error("Amount must be between ₹0.01 and ₹10,00,000.");
  return amount;
};

// This form is local to the marketplace workflow; all controls and feedback are shared UI.
function ActionForm({ title, button, busy, onSubmit, children }) {
  const [error, setError] = useState("");
  return <Card title={title}><form className="paid-services-form" onSubmit={async (event) => {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget; setError("");
    try { if (await onSubmit(Object.fromEntries(new FormData(form)))) form.reset(); }
    catch (failure) { setError(failure.message); }
  }}><fieldset disabled={busy}>{children}<Button type="submit" loading={busy}>{button}</Button></fieldset>{error && <ErrorState message={error} />}</form></Card>;
}

function CatalogueModal({ entry, busy, onClose, onSave }) {
  return <Modal isOpen onClose={busy ? undefined : onClose} title={entry?.id ? "Edit service" : "Add service"}>
    <ActionForm title="Catalogue details" button="Save service" busy={busy} onSubmit={async (values) => onSave(entry?.id, {
      name: values.name.trim(), description: values.description.trim(), specialization: values.specialization,
      startingPricePaise: asPaise(values.price), active: values.active === "true",
    })}>
      <Input label="Service name" name="name" maxLength={100} required defaultValue={entry?.name || ""} />
      <Textarea label="Description" name="description" maxLength={2000} required defaultValue={entry?.description || ""} />
      <Select label="Worker specialization" name="specialization" defaultValue={entry?.specialization || ""} required><option value="">Choose specialization</option>{workTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}</Select>
      <Input label="Starting price (INR)" name="price" type="number" min="0.01" max="1000000" step="0.01" required defaultValue={entry ? entry.startingPricePaise / 100 : ""} hint="A guide price; the worker submits an estimate for resident approval." />
      <Select label="Availability" name="active" defaultValue={String(entry?.active ?? true)}><option value="true">Available to residents</option><option value="false">Inactive</option></Select>
    </ActionForm>
  </Modal>;
}

function BookingModal({ entry, busy, onClose, onCreate }) {
  const clientRequestId = useRef(crypto.randomUUID());
  return <Modal isOpen onClose={busy ? undefined : onClose} title={`Request ${entry.name}`}>
    <p className="paid-services-prose">{entry.description}</p><p>Starting from <strong>{money(entry.startingPricePaise)}</strong>. You approve the worker's estimate before work starts. Payment is to the assigned maintenance worker.</p>
    <ActionForm title="Your request" button="Request service" busy={busy} onSubmit={(values) => onCreate({ catalogueId: entry.id, clientRequestId: clientRequestId.current, description: values.description.trim() })}>
      <Textarea label="Describe the work needed in your apartment" name="description" required maxLength={2000} rows={5} />
    </ActionForm>
  </Modal>;
}

function RequestDetails({ id, role, onClose, onChanged }) {
  const loader = useCallback((signal) => service.request(id, signal), [id]);
  const resource = useAsyncResource(loader);
  const item = resource.data;
  const isAuthority = authorityRoles.includes(role), isResident = role === "RESIDENT", isWorker = role === "MAINTENANCE_WORKER";
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const locked = useRef(false);
  const { showToast } = useToast();
  const workerLoader = useCallback((signal) => isAuthority && item?.status === "REQUESTED" ? service.workers(id, signal) : Promise.resolve([]), [id, isAuthority, item?.status]);
  const workers = useAsyncResource(workerLoader);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function run(action, payload = {}) {
    if (locked.current || !item) return false;
    locked.current = true; setBusy(true); setError("");
    try {
      const result = action === "upload" ? await service.uploadEvidence(id, payload.file) : await service.action(id, action, { ...payload, version: item.version });
      resource.setData(result); showToast({ type: "success", message: "Service request updated." });
      await onChanged(); return true;
    } catch (failure) { setError(failure.message); showToast({ type: "error", message: failure.message }); return false; }
    finally { locked.current = false; setBusy(false); }
  }
  async function viewEvidence(entry) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try { const blob = await service.evidence(id, entry.id); setPreview({ url: URL.createObjectURL(blob), name: entry.originalName }); }
    catch (failure) { setError(failure.message); }
    finally { locked.current = false; setBusy(false); }
  }
  const current = item?.estimates.at(-1);
  const payment = item?.payment;
  const disabled = busy || resource.loading;
  return <><Modal isOpen size="lg" onClose={busy || confirmCancel ? undefined : onClose} title={item?.service.name || "Service request"} footer={<Button variant="secondary" onClick={onClose} disabled={busy}>Close</Button>}>
    <div className="paid-services-stack">
      <div className="paid-services-actions"><Button variant="secondary" onClick={resource.reload} disabled={disabled}>Refresh details</Button></div>
      {resource.loading && <LoadingState message="Loading service request..." />}
      {resource.error && <ErrorState message={resource.error.message} onRetry={resource.reload} />}
      {error && <ErrorState message={error} />}
      {item && <>
        <Card title="Request details" actions={<StatusBadge status={item.status} />}>
          <p className="paid-services-prose">{item.description}</p>
          <dl className="paid-services-facts">
            <div><dt>Resident</dt><dd>{item.residentName || "Resident account unavailable"}</dd></div>
            <div><dt>Assigned worker / intended payee</dt><dd>{item.workerName || "Awaiting assignment"}</dd></div>
            <div><dt>Service location</dt><dd>{[item.location.communityName, item.location.towerName, item.location.floorLabel, item.location.apartmentNumber].join(" / ")}</dd></div>
            <div><dt>Requested</dt><dd>{date(item.createdAt)}</dd></div>
            <div><dt>Appointment</dt><dd>{item.appointment ? `${date(item.appointment.startsAt)} – ${date(item.appointment.endsAt)}` : "Awaiting approved estimate"}</dd></div>
          </dl>
        </Card>
        {isAuthority && item.status === "REQUESTED" && <Card title="Assign an eligible maintenance worker">
          {workers.loading ? <LoadingState /> : workers.error ? <ErrorState message={workers.error.message} onRetry={workers.reload} /> : !workers.data?.length ? <EmptyState title="No eligible workers" message="A worker must be available, have matching specialization, and belong to this community." /> :
            <ActionForm button="Assign worker" busy={disabled} onSubmit={(values) => run("assign", { workerId: values.workerId })}>
              <Select label="Available worker" name="workerId" required><option value="">Choose worker</option>{workers.data.map((worker) => <option key={worker.id} value={worker.id}>{worker.userName} · {label(worker.specialization)}</option>)}</Select>
            </ActionForm>}
        </Card>}
        {item.estimates.length > 0 && <Card title="Estimate history"><div className="paid-services-stack">{item.estimates.map((estimate) => <section key={estimate.id}>
          <p><strong>Estimate {estimate.number}: {money(estimate.amountPaise)}</strong> <StatusBadge status={estimate.status} /></p>
          <p className="paid-services-prose">{estimate.description}</p><p className="paid-services-muted">Submitted {date(estimate.submittedAt)}{estimate.decidedAt && ` · Decided ${date(estimate.decidedAt)}`}</p>
          {estimate.decisionNote && <p className="paid-services-prose">Resident note: {estimate.decisionNote}</p>}
        </section>)}</div></Card>}
        {isWorker && ["ASSIGNED", "ESTIMATE_REJECTED", "REVISION_REQUESTED", "ESTIMATE_APPROVED", "SCHEDULED", "IN_PROGRESS"].includes(item.status) && <ActionForm title={item.estimates.length ? "Submit revised estimate" : "Submit estimate"} button="Send estimate for resident approval" busy={disabled} onSubmit={(values) => run("estimates", { amountPaise: asPaise(values.amount), description: values.description.trim() })}>
          <p>Enter the total price for the entire service, including materials and any additional work. A revision pauses work until the resident approves it.</p>
          <Input label="Total estimate (INR)" name="amount" type="number" min="0.01" max="1000000" step="0.01" required />
          <Textarea label="Scope, materials, and cost breakdown" name="description" maxLength={2000} required />
        </ActionForm>}
        {isResident && item.status === "AWAITING_ESTIMATE_APPROVAL" && <ActionForm title="Decide the latest estimate" button="Submit estimate decision" busy={disabled} onSubmit={(values) => run("estimate-decision", { estimateId: current.id, decision: values.decision, ...(values.note.trim() ? { note: values.note.trim() } : {}) })}>
          <p>Proposed total: <strong>{money(current.amountPaise)}</strong>. Approval authorizes this scope and maximum price.</p>
          <Select label="Your decision" name="decision" required><option value="">Choose decision</option><option value="APPROVE">Approve estimate</option><option value="REJECT">Reject estimate</option><option value="REQUEST_REVISION">Request revision</option></Select>
          <Textarea label="Decision note" name="note" maxLength={2000} hint="Required when rejecting or requesting changes." />
        </ActionForm>}
        {(isResident || isAuthority) && ["ESTIMATE_APPROVED", "SCHEDULED"].includes(item.status) && <ActionForm title="Schedule appointment" button="Save appointment" busy={disabled} onSubmit={(values) => {
          const start = new Date(values.startsAt), end = new Date(values.endsAt);
          if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new Error("Choose valid appointment times.");
          return run("schedule", { startsAt: start.toISOString(), endsAt: end.toISOString() });
        }}>
          <p>Times use your device's local timezone. Choose a future window of up to 8 hours; work must start within this window.</p>
          <Input label="Starts at" name="startsAt" type="datetime-local" required /><Input label="Ends at" name="endsAt" type="datetime-local" required />
        </ActionForm>}
        {isWorker && item.status === "SCHEDULED" && <Card title="Begin chargeable work"><p>Start only within the scheduled appointment and the latest approved scope.</p><Button loading={busy} disabled={disabled} onClick={() => run("start")}>Start work</Button></Card>}
        {isWorker && item.status === "IN_PROGRESS" && <ActionForm title="Report work progress" button="Post progress update" busy={disabled} onSubmit={(values) => run("progress", { note: values.note.trim() })}>
          <Textarea label="Progress update" name="note" maxLength={2000} required />
        </ActionForm>}
        {isWorker && ["IN_PROGRESS", "FINAL_COST_REJECTED"].includes(item.status) && <ActionForm title="Completion and final cost" button="Submit completion for review" busy={disabled} onSubmit={(values) => run("complete", { finalCostPaise: asPaise(values.amount), completionReport: values.report.trim() })}>
          <p>Final cost cannot exceed the latest approved estimate of {money(current?.amountPaise)}. Obtain an approved revision before additional chargeable work.</p>
          <Textarea label="Work completed and materials used" name="report" maxLength={2000} required defaultValue={item.completionReport || ""} />
          <Input label="Final total (INR)" name="amount" type="number" min="0.01" max={current?.amountPaise / 100} step="0.01" required defaultValue={item.finalCostPaise ? item.finalCostPaise / 100 : ""} />
        </ActionForm>}
        {item.completedAt && <Card title="Completion report"><p className="paid-services-prose">{item.completionReport}</p><p>Final cost: <strong>{money(item.finalCostPaise)}</strong> · Submitted {date(item.completedAt)}</p>{item.finalReview && <p className="paid-services-prose">Authority review: {item.finalReview.note} ({item.finalReview.approved ? "Approved" : "Changes requested"})</p>}</Card>}
        {isAuthority && item.status === "COMPLETED" && <ActionForm title="Review completion and final cost" button="Submit final-cost review" busy={disabled} onSubmit={(values) => run("final-cost-review", { approved: values.approved === "true", note: values.note.trim() })}>
          <Select label="Decision" name="approved" required><option value="">Choose decision</option><option value="true">Approve completion and final cost</option><option value="false">Request a corrected completion report / cost</option></Select>
          <Textarea label="Review note" name="note" maxLength={2000} required />
        </ActionForm>}
        {isAuthority && item.status === "FINAL_COST_APPROVED" && !payment && <Card title="Authorize worker payment"><p>Authorize {money(item.finalCostPaise)} to {item.workerName || "the assigned worker"}. This creates a tracking record and transfers no funds.</p><Button loading={busy} disabled={disabled} onClick={() => run("payment-approval")}>Authorize worker payment</Button></Card>}
        {payment && <Card title="Worker payment tracking" actions={<StatusBadge status={payment.status} />}>
          <p><strong>{money(payment.amountPaise)}</strong> payable to {item.workerName || "the assigned maintenance worker"}.</p>
          <p className="paid-services-muted">Payments take place outside Urbanity. Evidence verification and receipt acknowledgement are manual; there is no payment gateway or automatic transfer.</p>
          <dl className="paid-services-facts"><div><dt>Payment record</dt><dd>{payment.id}</dd></div><div><dt>Worker payee ID</dt><dd>{payment.payeeUserId}</dd></div>{payment.reference && <div><dt>External transaction reference</dt><dd>{payment.reference}</dd></div>}{payment.verifiedAt && <div><dt>Evidence verified</dt><dd>{date(payment.verifiedAt)} · {payment.verificationNote}</dd></div>}{payment.receiptConfirmedAt && <div><dt>Worker acknowledged receipt</dt><dd>{date(payment.receiptConfirmedAt)}</dd></div>}</dl>
        </Card>}
        {isResident && payment?.status === "APPROVED" && <>
          <ActionForm title="Upload external payment evidence" button="Upload evidence" busy={disabled} onSubmit={(values) => {
            const file = values.file;
            if (!file?.size || file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image up to 5 MB.");
            return run("upload", { file });
          }}><Input label="Payment evidence image" name="file" type="file" accept="image/png,image/jpeg,image/webp" required hint="Up to five images, each at most 5 MB. Upload a receipt for payment to the assigned worker." /></ActionForm>
          {item.evidence.length > 0 && <ActionForm title="Report payment to worker" button="Report external payment" busy={disabled} onSubmit={(values) => run("payment-report", { reference: values.reference.trim(), evidenceId: values.evidenceId })}>
            <Input label="Bank / UPI transaction reference" name="reference" maxLength={200} required />
            <Select label="Payment evidence" name="evidenceId" required><option value="">Choose receipt</option>{item.evidence.map((entry) => <option key={entry.id} value={entry.id}>{entry.originalName}</option>)}</Select>
          </ActionForm>}
        </>}
        {item.evidence.length > 0 && <Card title="Payment evidence"><div className="paid-services-stack">{item.evidence.map((entry) => <div key={entry.id}><Button variant="secondary" disabled={disabled} onClick={() => viewEvidence(entry)}>{entry.originalName}{payment?.evidenceId === entry.id ? " (reported receipt)" : ""}</Button></div>)}{preview && <figure><img className="paid-services-preview" src={preview.url} alt={`Payment evidence: ${preview.name}`} /><figcaption>{preview.name}</figcaption></figure>}</div></Card>}
        {isAuthority && payment?.status === "PAYMENT_REPORTED" && <ActionForm title="Verify reported payment evidence" button="Record evidence decision" busy={disabled} onSubmit={(values) => run("payment-verification", { approved: values.approved === "true", verificationNote: values.note.trim() })}>
          <p>Inspect the reported receipt and independently confirm its amount, intended worker payee, and transaction reference before recording verification.</p>
          <Select label="Evidence decision" name="approved" required><option value="">Choose decision</option><option value="true">Evidence verified manually</option><option value="false">Reject evidence and request correction</option></Select>
          <Textarea label="Verification details" name="note" maxLength={2000} required />
        </ActionForm>}
        {isWorker && payment?.status === "EVIDENCE_VERIFIED" && <Card title="Acknowledge receipt"><p>Confirm only if you have personally received {money(payment.amountPaise)} for this service.</p><Button disabled={disabled} loading={busy} onClick={() => run("payment-receipt")}>I received this payment</Button></Card>}
        {isResident && item.status === "FINAL_COST_APPROVED" && !item.review && <ActionForm title="Review your service" button="Submit review" busy={disabled} onSubmit={(values) => run("review", { rating: Number(values.rating), feedback: values.feedback.trim() })}>
          <Select label="Rating" name="rating" required><option value="">Choose rating</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</Select>
          <Textarea label="Your experience" name="feedback" maxLength={2000} required />
        </ActionForm>}
        {item.review && <Card title="Resident review"><RatingStars value={item.review.rating} /><p className="paid-services-prose">{item.review.feedback}</p></Card>}
        {(isResident || isAuthority) && !item.startedAt && item.status !== "CANCELLED" && <Card title="Cancel request"><p>Cancellation is available before chargeable work starts.</p><Button variant="danger" disabled={disabled} onClick={() => setConfirmCancel(true)}>Cancel service request</Button></Card>}
        <Card title="Activity history"><ol className="paid-services-history">{item.history.map((entry, index) => <li key={index}><span>{date(entry.at)}</span> · <StatusBadge status={entry.status} /><p>{entry.note}</p></li>)}</ol></Card>
      </>}
    </div>
  </Modal><ConfirmDialog isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={async () => { if (await run("cancel")) setConfirmCancel(false); }} loading={busy} title="Cancel service request" message="Cancel this request and release its assigned worker?" confirmLabel="Cancel request" cancelLabel="Keep request" /></>;
}

export function PaidServicesPage() {
  const { user } = useAuth();
  const role = user.role, isResident = role === "RESIDENT", isAdmin = role === "COMMUNITY_ADMIN";
  const { showToast } = useToast();
  const loader = useCallback(async (signal) => {
    const [catalogue, requests] = await Promise.all([service.catalogue(signal), service.requests(signal)]);
    return { catalogue, requests };
  }, []);
  const resource = useAsyncResource(loader);
  const [catalogueModal, setCatalogueModal] = useState(null), [booking, setBooking] = useState(null), [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false), [filter, setFilter] = useState("ALL");
  const locked = useRef(false);
  async function mutate(action, afterSuccess) {
    if (locked.current) return false;
    locked.current = true; setBusy(true);
    try { await action(); afterSuccess(); showToast({ type: "success", message: "Saved successfully." }); await resource.reload(); return true; }
    catch (error) { showToast({ type: "error", message: error.message }); throw error; }
    finally { locked.current = false; setBusy(false); }
  }
  const rows = (resource.data?.requests || []).filter((item) => filter === "ALL" || (filter === "HISTORY" ? ["FINAL_COST_APPROVED", "CANCELLED"].includes(item.status) : !["FINAL_COST_APPROVED", "CANCELLED"].includes(item.status)));
  return <div className="paid-services-stack">
    <PageHeader eyebrow="Paid services" title={isResident ? "Services marketplace" : "Paid service requests"} description="Apartment services performed by your community's maintenance workers." actions={<Button variant="secondary" disabled={busy || resource.loading} onClick={resource.reload}>Refresh</Button>} />
    {resource.loading && <LoadingState message="Loading services..." />}
    {resource.error && <ErrorState message={resource.error.message} onRetry={resource.reload} />}
    {resource.data && <>
      {(isResident || isAdmin) && <Card title="Service catalogue" actions={isAdmin && <Button onClick={() => setCatalogueModal({})}>Add service</Button>}>
        {!resource.data.catalogue.length ? <EmptyState title="No services available" message={isAdmin ? "Add a community service to make it available to residents." : "Your Community Admin has not published any services yet."} /> : <div className="paid-services-grid">{resource.data.catalogue.map((entry) => <Card key={entry.id} title={entry.name} actions={<StatusBadge status={entry.active ? "AVAILABLE" : "INACTIVE"} />}>
          <p className="paid-services-prose">{entry.description}</p><p>{label(entry.specialization)} · From <strong>{money(entry.startingPricePaise)}</strong></p>
          <Button variant={isResident ? "primary" : "secondary"} onClick={() => isResident ? setBooking(entry) : setCatalogueModal(entry)}>{isResident ? "Request service" : "Edit service"}</Button>
        </Card>)}</div>}
      </Card>}
      <Card title={isResident ? "My requests and service history" : "Service requests"} actions={<Select aria-label="Filter service requests" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All requests</option><option value="ACTIVE">Active requests</option><option value="HISTORY">Completed / cancelled</option></Select>} flush>
        <DataTable rows={rows} columns={[
          { key: "service", header: "Service", render: (value) => value.name },
          { key: "residentName", header: "Resident", render: (value) => value || "Unavailable" },
          { key: "workerName", header: "Worker", render: (value) => value || "Not assigned" },
          { key: "status", header: "Status", render: (value) => <StatusBadge status={value} /> },
          { key: "payment", header: "Payment", render: (value) => value ? <StatusBadge status={value.status} /> : "Not authorized" },
          { key: "actions", header: "Details", render: (_, row) => <Button variant="secondary" onClick={() => setSelected(row.id)}>View request</Button> },
        ]} emptyTitle="No service requests" emptyMessage={isResident ? "Browse the catalogue to request an apartment service." : "Requests in your authorized scope will appear here."} />
      </Card>
    </>}
    {catalogueModal && <CatalogueModal entry={catalogueModal} busy={busy} onClose={() => setCatalogueModal(null)} onSave={(id, payload) => mutate(() => service.saveCatalogue(id, payload), () => setCatalogueModal(null))} />}
    {booking && <BookingModal entry={booking} busy={busy} onClose={() => setBooking(null)} onCreate={(payload) => mutate(() => service.create(payload), () => setBooking(null))} />}
    {selected && <RequestDetails key={selected} id={selected} role={role} onClose={() => setSelected(null)} onChanged={resource.reload} />}
  </div>;
}
