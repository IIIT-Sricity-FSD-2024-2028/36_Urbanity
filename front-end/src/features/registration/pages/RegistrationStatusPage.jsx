import { useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Input,
  LoadingState,
  useToast,
} from "../../../components/ui/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { useAsyncResource } from "../../../hooks/useAsyncResource.js";
import { registrationService as service } from "../services/registrationService.js";
import { money, words } from "../registrationModel.mjs";
import "../registration.css";

export function RegistrationStatusPage() {
  const { reference } = useParams();
  const resource = useAsyncResource(
    useCallback((signal) => service.status(reference, signal), [reference]),
  );
  const [paymentPhase, setPaymentPhase] = useState(null);
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [setupReady, setSetupReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const lock = useRef(false),
    paymentRequests = useRef({});
  const toast = useToast();
  async function act(work, message) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
      toast.showToast({ type: "success", message });
    } catch (err) {
      setError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const a = resource.data;
  return (
    <main className="registration-page">
      <nav className="registration-nav">
        <Link to={ROUTES.HOME}>URBANITY</Link>
        <Link to={ROUTES.LOGIN}>Login</Link>
      </nav>
      <h1>Community registration</h1>
      <p className="registration-reference">Reference: {reference}</p>
      {resource.loading && <LoadingState />}
      {resource.error && (
        <ErrorState
          message={resource.error.message}
          onRetry={resource.reload}
        />
      )}
      {error && <ErrorState message={error.message} />}
      {a && (
        <>
          <Card
            title={a.details.communityName}
            actions={
              <Button
                variant="secondary"
                disabled={busy || resource.loading}
                onClick={resource.reload}
              >
                Refresh status
              </Button>
            }
          >
            <p>
              <strong>{words(a.status)}</strong>
            </p>
            <p>
              Application received. Save this page and return in this browser.
              Your private session lasts 30 days; contact the platform
              administrator with your reference if it expires. No email has been
              sent automatically.
            </p>
            <dl className="registration-facts">
              <div>
                <dt>Total fee</dt>
                <dd>{money(a.pricing.totalMinor)}</dd>
              </div>
              <div>
                <dt>Initial requirement</dt>
                <dd>{money(a.pricing.initialMinor)}</dd>
              </div>
              <div>
                <dt>Initial payment satisfied</dt>
                <dd>{money(a.initialVerifiedMinor)}</dd>
              </div>
              <div>
                <dt>Total payments credited</dt>
                <dd>{money(a.verifiedMinor)}</dd>
              </div>
              <div>
                <dt>Outstanding balance</dt>
                <dd>{money(a.outstandingMinor)}</dd>
              </div>
              <div>
                <dt>Verified mock payments (evaluation only)</dt>
                <dd>{money(a.mockVerifiedMinor)}</dd>
              </div>
              <div>
                <dt>Evidence awaiting verification</dt>
                <dd>{money(a.pendingMinor)}</dd>
              </div>
              <div>
                <dt>Account setup</dt>
                <dd>
                  {a.credentialSetupAt
                    ? "Complete"
                    : "Awaiting approval or setup"}
                </dd>
              </div>
            </dl>
            {a.decision === "APPROVED" && a.credentialSetupAt && (
              <p>
                Your Community Admin account has been created with the default
                password. Sign in now and change it under Profile / Edit
                profile.
              </p>
            )}
            {a.status === "ACTIVE" && (
              <p>
                Your community is active. <Link to={ROUTES.LOGIN}>Log in</Link>{" "}
                to configure it using the existing Community Admin portal.
              </p>
            )}
            {a.decision === "REJECTED" && (
              <p>
                Application rejected:{" "}
                {
                  a.audit.findLast((event) => event.action === "REJECTED")
                    ?.reason
                }
                .{" "}
                {a.reconciliationRequired &&
                  "Historical payment records are preserved. No refund has been recorded."}
              </p>
            )}
            {a.status === "READY_FOR_ACTIVATION" && (
              <p>
                Your application is approved. Ask the Super Admin to retry
                approval to enable your existing account.
              </p>
            )}
          </Card>
          {a.decision !== "REJECTED" && a.payableMinor > 0 && (
            <Card
              title={
                a.decision === "PENDING"
                  ? "Initial mock payment"
                  : "Remaining mock payment"
              }
            >
              <p>
                <strong>Mock Payment — Evaluation Only</strong>
              </p>
              <p>
                No real money is transferred. Amount due:{" "}
                <strong>{money(a.payableMinor)}</strong>.
              </p>
              <Button
                disabled={busy || a.pendingMinor > 0}
                onClick={() => {
                  setError(null);
                  setPaymentPhase(
                    a.decision === "PENDING" ? "INITIAL" : "REMAINING",
                  );
                }}
              >
                {a.decision === "PENDING"
                  ? "Pay Initial Amount"
                  : "Pay Remaining Amount"}
              </Button>
            </Card>
          )}
          {a.decision === "APPROVED" && !a.credentialSetupAt && (
            <Card title="Set up your Community Admin password">
              <p>
                A one-time setup session lasts one hour. Completing setup
                enables login for your approved application.
              </p>
              {!setupReady ? (
                <Button
                  loading={busy}
                  onClick={() =>
                    act(async () => {
                      await service.beginSetup(reference);
                      setSetupReady(true);
                    }, "Secure setup session started.")
                  }
                >
                  Start secure password setup
                </Button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(async () => {
                      if (password !== confirmation)
                        throw new Error("Passwords must match.");
                      resource.setData(
                        await service.setup(reference, password),
                      );
                      setPassword("");
                      setConfirmation("");
                      setSetupReady(false);
                    }, "Password set. You can now sign in.");
                  }}
                >
                  <div className="registration-grid">
                    <Input
                      label="New password"
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                    />
                    <Input
                      label="Confirm password"
                      required
                      type="password"
                      autoComplete="new-password"
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="registration-actions">
                    <Button type="submit" loading={busy}>
                      Set password
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        act(
                          () => service.beginSetup(reference),
                          "Setup session renewed for one hour.",
                        )
                      }
                    >
                      Renew setup session
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          )}
          <Card title="Payment history">
            {a.payments.length ? (
              <ul className="registration-history">
                {a.payments.map((p) => (
                  <li key={p.id}>
                    <strong>
                      {money(p.amountMinor)} /{" "}
                      {p.kind === "MOCK" ? "mock / " : "manual / "}
                      {words(p.phase)} / {words(p.status)}
                    </strong>
                    <br />
                    {p.transactionReference}
                    {p.reason && <p>Review: {p.reason}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No payments recorded.</p>
            )}
          </Card>
        </>
      )}
      <ConfirmDialog
        isOpen={!!paymentPhase}
        onClose={() => {
          if (!busy) {
            setPaymentPhase(null);
            setError(null);
          }
        }}
        title="Confirm mock payment"
        confirmLabel="Confirm Mock Payment"
        confirmVariant="primary"
        loading={busy}
        message={
          <>
            <strong>Mock Payment — Evaluation Only</strong>
            <p>
              Confirm {money(a?.payableMinor || 0)} for the{" "}
              {paymentPhase === "INITIAL" ? "initial" : "remaining"}{" "}
              registration amount. No real money will be transferred.
            </p>
            {error && <ErrorState message={error.message} />}
          </>
        }
        onConfirm={() =>
          act(async () => {
            const phase = paymentPhase;
            paymentRequests.current[phase] ||= crypto.randomUUID();
            resource.setData(
              await service.mockPayment(reference, {
                phase,
                requestId: paymentRequests.current[phase],
              }),
            );
            setPaymentPhase(null);
          }, "Mock payment successful")
        }
      />
    </main>
  );
}
