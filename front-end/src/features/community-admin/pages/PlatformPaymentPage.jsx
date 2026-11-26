import { useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Badge, Button, Card, ConfirmDialog, ErrorState, LoadingState, useToast } from "../../../components/ui/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { ROLES } from "../../../constants/roles.js";
import { money } from "../../registration/registrationModel.mjs";
import "../../registration/registration.css";
import {
  useGetPlatformPaymentSummaryQuery, useGetPlatformPaymentHistoryQuery,
  useGetPlatformPaymentReceiptQuery, usePayPlatformBalanceMutation,
} from "../services/platformPaymentsApi.js";

const receiptPath = (id) => `${ROUTES.PLATFORM_PAYMENT}/receipts/${id}`;

function PaymentFacts({ items }) {
  return <dl className="registration-facts">
    {items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}

function PaymentReceipt({ payment }) {
  return <Card title="Payment receipt">
    <PaymentFacts items={[
      ["Transaction reference", payment.transactionReference],
      ["Amount", money(payment.amountMinor)],
      ["Payment type", payment.phase === "INITIAL" ? "Initial payment" : "Remaining payment"],
      ["Method", payment.kind === "MOCK" ? "Mock payment" : "Verified payment evidence"],
      ["Status", payment.status.replaceAll("_", " ")],
      ["Recorded at", new Date(payment.createdAt).toLocaleString()],
      ...(payment.payer ? [["Paid by", payment.payer.name]] : []),
    ]} />
    <Link to={ROUTES.PLATFORM_PAYMENT}>Back to payment history</Link>
  </Card>;
}

function CommunityPayment() {
  const { sessionRevision, platformPaymentRequired, refreshUser } = useAuth();
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [accessError, setAccessError] = useState(null);
  const [refreshingAccess, setRefreshingAccess] = useState(false);
  const lock = useRef(false);
  const [pay, mutation] = usePayPlatformBalanceMutation();
  const options = { refetchOnMountOrArgChange: true };
  const summary = useGetPlatformPaymentSummaryQuery(sessionRevision, options);
  const history = useGetPlatformPaymentHistoryQuery(sessionRevision, options);
  const receipt = useGetPlatformPaymentReceiptQuery({ sessionRevision, id: paymentId }, { ...options, skip: !paymentId });
  const data = summary.isError ? null : summary.currentData;
  const paid = data?.paymentStatus === "FULLY_PAID";

  async function checkAccess() {
    setRefreshingAccess(true);
    setAccessError(null);
    try {
      await refreshUser();
    } catch {
      setAccessError("Unable to refresh account access. Try again to continue.");
    } finally {
      setRefreshingAccess(false);
    }
  }

  async function confirmPayment() {
    if (lock.current || !data || paid || data.pendingVerification) return;
    lock.current = true;
    try {
      const payment = await pay({ sessionRevision, registrationLinked: data.registrationLinked }).unwrap();
      setConfirming(false);
      showToast({ type: "success", message: "Mock payment successful" });
      if (data.registrationLinked) navigate(receiptPath(payment.id), { replace: true });
      await checkAccess();
    } catch (error) {
      showToast({ type: "error", message: error.message || "Unable to complete mock payment." });
    } finally {
      lock.current = false;
    }
  }

  return <>
    {summary.isLoading && <LoadingState message="Loading platform balance..." />}
    {summary.isError && <ErrorState message={summary.error.message} onRetry={summary.refetch} />}
    {data && <Card title={data.communityName}>
      <Badge variant={paid ? "success" : "warning"}>{paid ? "Fully paid" : "Payment required"}</Badge>
      <PaymentFacts items={[
        ["Total platform fee", money(data.totalMinor)],
        ...(data.registrationLinked ? [["Initial payment credited", money(data.initialVerifiedMinor)]] : []),
        ["Total paid", money(data.paidMinor)],
        ["Amount currently due", money(data.outstandingMinor)],
        ...(data.previousReference ? [["Previous transaction reference", data.previousReference]] : []),
      ]} />
      {data.pendingVerification && <p>Payment evidence is awaiting Super Admin review.</p>}
      {data.outstandingMinor > 0 && <Button disabled={data.pendingVerification || summary.isFetching}
        onClick={() => { mutation.reset(); setConfirming(true); }}>
        {data.registrationLinked ? "Pay Remaining Amount" : "Pay Platform Fee"}
      </Button>}
      {paid && platformPaymentRequired && <Button onClick={checkAccess} loading={refreshingAccess}>Refresh account access</Button>}
    </Card>}
    {accessError && <ErrorState message={accessError} onRetry={checkAccess} />}
    {paymentId && receipt.isLoading && <LoadingState message="Loading receipt..." />}
    {paymentId && receipt.isError && <ErrorState message={receipt.error.message} onRetry={receipt.refetch} />}
    {paymentId && !receipt.isError && receipt.currentData && <PaymentReceipt payment={receipt.currentData} />}
    <Card title="Payment history">
      {history.isLoading && <LoadingState />}
      {history.isError && <ErrorState message={history.error.message} onRetry={history.refetch} />}
      {!history.isError && history.currentData && (history.currentData.length ? <ul className="registration-history">
        {history.currentData.map((payment) => <li key={payment.id}>
          <strong>{payment.phase === "INITIAL" ? "Initial payment" : "Remaining payment"} · {money(payment.amountMinor)}</strong>
          <p>{payment.kind === "MOCK" ? "Mock payment" : "Payment evidence"} · {payment.status.replaceAll("_", " ")} · {new Date(payment.createdAt).toLocaleString()}</p>
          <Link to={receiptPath(payment.id)}>{payment.transactionReference}</Link>
        </li>)}
      </ul> : <p>No itemized platform receipts recorded.</p>)}
    </Card>
    <ConfirmDialog isOpen={confirming} onClose={() => setConfirming(false)} onConfirm={confirmPayment}
      title="Confirm mock payment" confirmLabel="Confirm Mock Payment" confirmVariant="primary"
      loading={mutation.isLoading}
      message={`Simulate a payment of ${money(data?.outstandingMinor)} for ${data?.communityName || "your community"}. No real money will be transferred.${mutation.error ? ` ${mutation.error.message}` : ""}`} />
  </>;
}

export function PlatformPaymentPage() {
  const { user, logout, platformPaymentRequired } = useAuth();
  const admin = user?.role === ROLES.COMMUNITY_ADMIN;
  if (!admin && !platformPaymentRequired) return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  return <main className="registration-page">
    <nav className="registration-nav">
      <span>Urbanity</span>
      <Button variant="secondary" onClick={logout}>Log out</Button>
    </nav>
    <h1>Platform payment</h1>
    {admin ? <>
      <p>Mock payment for evaluation only. No real money will be transferred.</p>
      {platformPaymentRequired && <p>Complete the outstanding platform fee to unlock community operations.</p>}
      {!platformPaymentRequired && <p><Link to={ROUTES.COMMUNITY_ADMIN}>Continue to dashboard</Link></p>}
      <CommunityPayment />
    </> : <Card title="Community payment required">
      <p>Contact your Community Admin. Your portal will be available after the community pays the platform balance.</p>
    </Card>}
  </main>;
}
