import { useCallback, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
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
  PageHeader,
} from "../../../components/data-display/index.js";
import { useAsyncResource } from "../../../hooks/useAsyncResource.js";
import { registrationAdminService as service } from "../services/registrationAdminService.js";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value / 100);
const words = (value) => String(value).toLowerCase().replaceAll("_", " ");
const statuses = [
  "AWAITING_INITIAL_PAYMENT",
  "PAYMENT_UNDER_REVIEW",
  "AWAITING_REVIEW",
  "AWAITING_REMAINING_PAYMENT",
  "AWAITING_ACCOUNT_SETUP",
  "READY_FOR_ACTIVATION",
  "ACTIVE",
  "REJECTED",
];

export function RegistrationsPage() {
  const resource = useAsyncResource(
    useCallback(async (signal) => {
      const [applications, pricing] = await Promise.all([
        service.list(signal),
        service.pricing(signal),
      ]);
      return { applications, pricing };
    }, []),
  );
  const [selected, setSelected] = useState(null),
    [filter, setFilter] = useState(""),
    [search, setSearch] = useState("");
  const [pricingDraft, setPricingDraft] = useState(null),
    [reason, setReason] = useState(""),
    [authority, setAuthority] = useState(false);
  const [confirm, setConfirm] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const lock = useRef(false),
    toast = useToast();
  const a = resource.data?.applications.find((a) => a.id === selected);
  const pricing = pricingDraft || resource.data?.pricing;
  async function act(work, message) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await work();
      if (result?.id)
        resource.setData((current) => ({
          ...current,
          applications: current.applications.map((a) =>
            a.id === result.id ? result : a,
          ),
        }));
      if (result?.notificationStatus === "FAILED") {
        setError(new Error(result.message));
        setConfirm(null);
        toast.showToast({ type: "warning", message: result.message });
        return;
      }
      toast.showToast({ type: "success", message: result?.message || message });
      setConfirm(null);
      setReason("");
      setAuthority(false);
    } catch (err) {
      setError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const openConfirm = (title, message, work) =>
    setConfirm({ title, message, work });
  const filtered =
    resource.data?.applications.filter(
      (item) =>
        (!filter ||
          item.status === filter ||
          (filter === "APPROVED" && item.decision === "APPROVED")) &&
        `${item.id} ${item.details.communityName} ${item.details.fullName} ${item.details.email}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  return (
    <div className="sa-registration-page">
      <PageHeader
        eyebrow="Platform onboarding"
        title="Community registrations"
        description="Review applications and evaluation payments, approve and enable Community Admin login with a simulated email."
        actions={
          <Button variant="secondary" disabled={busy} onClick={resource.reload}>
            Refresh
          </Button>
        }
      />
      {resource.loading && <LoadingState />}
      {resource.error && (
        <ErrorState
          message={resource.error.message}
          onRetry={resource.reload}
        />
      )}
      {error && !a && <ErrorState message={error.message} />}
      {resource.data && (
        <>
          <Card title="Evaluation payment configuration">
            <p>
              Total fee reuses the platform plan:{" "}
              {money(pricing.towerRate * 100)} per tower +{" "}
              {money(pricing.apartmentRate * 100)} per apartment. The initial
              payment is credited toward that total. Configuration changes apply
              only to new applications.
            </p>
            <form
              className="sa-form"
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  const result = await service.configure({
                    enabled: pricing.enabled,
                    initialPercent: Number(pricing.initialPercent),
                    paymentInstructions: pricing.paymentInstructions,
                  });
                  resource.setData((current) => ({
                    ...current,
                    pricing: result,
                  }));
                  setPricingDraft(null);
                }, "Evaluation payment configuration saved.");
              }}
            >
              <div className="sa-grid sa-grid--2">
                <Input
                  label="Initial payment (%)"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  required
                  value={pricing.initialPercent || ""}
                  disabled={busy}
                  onChange={(e) =>
                    setPricingDraft({
                      ...pricing,
                      initialPercent: e.target.value,
                    })
                  }
                />
                <Select
                  label="Public registration"
                  value={String(pricing.enabled)}
                  disabled={busy}
                  onChange={(e) =>
                    setPricingDraft({
                      ...pricing,
                      enabled: e.target.value === "true",
                    })
                  }
                >
                  <option value="false">Closed</option>
                  <option value="true">Open</option>
                </Select>
              </div>
              <Textarea
                label="Evaluation payment notice"
                required
                minLength={10}
                maxLength={1000}
                value={pricing.paymentInstructions}
                disabled={busy}
                onChange={(e) =>
                  setPricingDraft({
                    ...pricing,
                    paymentInstructions: e.target.value,
                  })
                }
                hint="Mock payments only. Never enter real payment details or credentials."
              />
              <Button type="submit" loading={busy}>
                Save configuration
              </Button>
            </form>
          </Card>
          <Card title="Applications">
            <div className="sa-grid sa-grid--2">
              <Input
                label="Search applications"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                label="Application status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All applications</option>
                <option value="APPROVED">Approved</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {words(status)}
                  </option>
                ))}
              </Select>
            </div>
            {filtered.length ? (
              <DataTable
                rowKey="id"
                rows={filtered}
                columns={[
                  {
                    key: "id",
                    header: "Reference",
                    render: (value) => (
                      <span style={{ overflowWrap: "anywhere" }}>{value}</span>
                    ),
                  },
                  {
                    key: "details",
                    header: "Community / representative",
                    render: (d) => (
                      <>
                        {d.communityName}
                        <br />
                        {d.fullName}
                        <br />
                        {d.email}
                      </>
                    ),
                  },
                  {
                    key: "createdAt",
                    header: "Submitted",
                    render: (value) => new Date(value).toLocaleDateString(),
                  },
                  { key: "status", header: "Status", render: words },
                  {
                    key: "initialVerifiedMinor",
                    header: "Initial verified",
                    render: (value, row) =>
                      `${money(value)} / ${money(row.pricing.initialMinor)}`,
                  },
                  {
                    key: "outstandingMinor",
                    header: "Outstanding",
                    render: money,
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (_, row) => (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelected(row.id);
                          setError(null);
                          setReason("");
                          setAuthority(false);
                        }}
                      >
                        Review
                      </Button>
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState
                title="No matching applications"
                message="Submitted registration requests will appear here."
              />
            )}
          </Card>
        </>
      )}
      <Modal
        isOpen={!!a && !confirm}
        onClose={
          busy || confirm
            ? undefined
            : () => {
                setSelected(null);
                setError(null);
              }
        }
        closeOnOverlay={!busy && !confirm}
        title="Registration application"
        size="lg"
      >
        {a && (
          <div className="sa-registration-detail">
            {error && <ErrorState message={error.message} />}
            <header className="sa-registration-detail__summary">
              <div>
                <h3>{a.details.communityName}</h3>
                <p className="sa-muted">Reference: {a.id}</p>
              </div>
              <Badge
                variant={
                  a.status === "ACTIVE"
                    ? "success"
                    : a.decision === "REJECTED"
                      ? "danger"
                      : "info"
                }
              >
                {words(a.status)}
              </Badge>
            </header>
            <dl className="sa-registration-detail__fees">
              <div>
                <dt>Total registration fee</dt>
                <dd>{money(a.pricing.totalMinor)}</dd>
              </div>
              <div>
                <dt>Initial payment credited</dt>
                <dd>
                  {money(a.initialVerifiedMinor)}{" "}
                  <small>of {money(a.pricing.initialMinor)}</small>
                </dd>
              </div>
              <div>
                <dt>Remaining balance</dt>
                <dd>{money(a.outstandingMinor)}</dd>
              </div>
            </dl>
            <div className="sa-registration-detail__grid">
              <Card title="Applicant">
                <strong>{a.details.fullName}</strong>
                <p>{a.details.email}</p>
                <p className="sa-muted">
                  {a.details.phone || "No phone provided"}
                </p>
              </Card>
              <Card title="Community details">
                <p>
                  {a.details.address}, {a.details.city}, {a.details.state},{" "}
                  {a.details.postalCode}, {a.details.country}
                </p>
                <p className="sa-muted">
                  {a.details.towers} towers / {a.details.floors} total floors /{" "}
                  {a.details.apartments} apartments (proposed)
                </p>
                {a.details.description && <p>{a.details.description}</p>}
                {a.details.notes && <p>{a.details.notes}</p>}
              </Card>
            </div>
            <Card
              title="Application review"
              className="sa-registration-detail__review"
            >
              <p className="sa-muted">
                Account setup:{" "}
                {a.credentialSetupAt
                  ? "Credentials ready"
                  : a.decision === "PENDING"
                    ? "Available after approval"
                    : "Awaiting applicant setup"}{" "}
                / Activation: {a.activatedAt ? "Active" : "Not activated"}
              </p>
              {a.decision === "REJECTED" && (
                <p>
                  Rejected:{" "}
                  {
                    a.audit.findLast((event) => event.action === "REJECTED")
                      ?.reason
                  }
                </p>
              )}
              {!a.activatedAt && a.decision !== "REJECTED" && (
                <>
                  <Textarea
                    label="Review reason"
                    value={reason}
                    minLength={5}
                    maxLength={1000}
                    disabled={busy}
                    onChange={(e) => setReason(e.target.value)}
                    hint="Required for application and payment decisions (at least 5 characters)."
                  />
                  {a.decision === "PENDING" && (
                    <>
                      <label className="sa-registration-authority">
                        <input
                          type="checkbox"
                          checked={authority}
                          disabled={busy}
                          onChange={(e) => setAuthority(e.target.checked)}
                        />
                        I independently verified the representative's identity
                        and authority.
                      </label>
                      <div className="sa-actions">
                        <Button
                          disabled={
                            busy ||
                            !authority ||
                            reason.trim().length < 5 ||
                            a.initialVerifiedMinor < a.pricing.initialMinor ||
                            a.pendingMinor > 0
                          }
                          onClick={() =>
                            openConfirm(
                              "Accept & Send Email?",
                              "Approve this application and record an evaluation email simulation. No real email or credentials are sent. A default password will be set. Approval immediately enables login and community configuration; the admin can change the password in Profile. Any remaining balance stays recorded separately.",
                              () =>
                                service.acceptAndNotify(a.id, {
                                  reason,
                                  confirmedAuthority: authority,
                                }),
                            )
                          }
                        >
                          Accept &amp; Send Email
                        </Button>
                        <Button
                          variant="danger"
                          disabled={busy || reason.trim().length < 5}
                          onClick={() =>
                            openConfirm(
                              "Reject registration?",
                              "This decision is final. Existing payments are retained for manual reconciliation.",
                              () =>
                                service.review(a.id, {
                                  decision: "REJECTED",
                                  reason,
                                }),
                            )
                          }
                        >
                          Reject application
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
              {a.decision === "APPROVED" &&
                (!a.activatedAt || !a.notifications?.length) && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      openConfirm(
                        "Retry simulated approval email?",
                        "The application is already approved. This enables login if needed and records only a missing simulated notification; no real email is sent.",
                        () =>
                          service.acceptAndNotify(a.id, {
                            reason: "Retry simulated approval notification",
                          }),
                      )
                    }
                  >
                    Retry Accept &amp; Send Email
                  </Button>
                )}
              <p className="sa-muted">
                Email actions are simulated for evaluation. No real email or
                credentials are sent.
              </p>
            </Card>
            <details className="sa-registration-detail__history">
              <summary>Account & payment details</summary>
              <dl className="sa-details">
                <div>
                  <dt>Total credited</dt>
                  <dd>{money(a.verifiedMinor)}</dd>
                </div>
                <div>
                  <dt>Pending verification</dt>
                  <dd>{money(a.pendingMinor)}</dd>
                </div>
                <div>
                  <dt>Community record</dt>
                  <dd>{a.communityId || "Created after approval"}</dd>
                </div>
                <div>
                  <dt>Admin record</dt>
                  <dd>{a.adminId || "Created after approval"}</dd>
                </div>
              </dl>
              {a.reconciliationRequired && (
                <p>
                  Manual payment reconciliation required. No refund has been
                  recorded.
                </p>
              )}
            </details>
            <details
              className="sa-registration-detail__history"
              open={a.pendingMinor > 0}
            >
              <summary>Payment history ({a.payments.length})</summary>
              {a.payments.length ? (
                a.payments.map((p) => (
                  <section key={p.id} className="sa-registration-payment">
                    <p>
                      <strong>
                        {money(p.amountMinor)} /{" "}
                        {p.kind === "MOCK" ? "mock / " : "manual / "}
                        {words(p.phase)} / {words(p.status)}
                      </strong>
                      <br />
                      Transaction: {p.transactionReference}
                      <br />
                      Submitted: {new Date(p.createdAt).toLocaleString()}
                    </p>
                    {p.reason && (
                      <p>
                        Review: {p.reason} ({p.reviewerId}, {p.reviewedAt})
                      </p>
                    )}
                    {p.status === "PENDING_VERIFICATION" &&
                      a.decision !== "REJECTED" && (
                        <div className="sa-actions">
                          <Button
                            disabled={busy || reason.trim().length < 5}
                            onClick={() =>
                              openConfirm(
                                "Verify payment?",
                                `Confirm actual receipt of ${money(p.amountMinor)} against transaction ${p.transactionReference}.`,
                                () =>
                                  service.reviewPayment(a.id, p.id, {
                                    decision: "VERIFIED",
                                    reason,
                                  }),
                              )
                            }
                          >
                            Verify receipt
                          </Button>
                          <Button
                            variant="danger"
                            disabled={busy || reason.trim().length < 5}
                            onClick={() =>
                              openConfirm(
                                "Reject payment evidence?",
                                "Rejected evidence will not reduce the outstanding fee.",
                                () =>
                                  service.reviewPayment(a.id, p.id, {
                                    decision: "REJECTED",
                                    reason,
                                  }),
                              )
                            }
                          >
                            Reject evidence
                          </Button>
                        </div>
                      )}
                  </section>
                ))
              ) : (
                <p>No payments recorded.</p>
              )}
            </details>
            <details className="sa-registration-detail__history">
              <summary>Application history ({a.audit.length})</summary>
              {a.notifications?.map((n) => (
                <p key={n.id}>
                  Simulated approval email: {n.recipient} / {n.subject} /{" "}
                  {n.status} / {new Date(n.createdAt).toLocaleString()}
                </p>
              ))}
              <ul className="sa-registration-history">
                {a.audit.map((event, index) => (
                  <li key={index}>
                    <strong>{words(event.action)}</strong> /{" "}
                    {new Date(event.at).toLocaleString()}
                    {event.actorId && <> / Admin {event.actorId}</>}
                    {event.reason && <p>{event.reason}</p>}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => {
          if (!busy) setConfirm(null);
        }}
        title={confirm?.title}
        message={
          <>
            {confirm?.message}
            {error && <ErrorState message={error.message} />}
          </>
        }
        confirmLabel="Confirm decision"
        confirmVariant="primary"
        loading={busy}
        onConfirm={() => act(confirm.work, "Registration updated.")}
      />
    </div>
  );
}
