import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorState, Input, LoadingState, useToast } from "../../../components/ui/index.js";
import { PageHeader } from "../../../components/data-display/index.js";
import { useCommunityResource } from "../hooks/useCommunityResource.js";
import { communityAdminService } from "../services/communityAdminService.js";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));

export function SubscriptionPage() {
  const { showToast } = useToast(); const loader = useCallback(() => communityAdminService.getSubscription(), []); const { data, loading, error, reload } = useCommunityResource(loader); const [form, setForm] = useState({ towers: "", apartments: "" }); const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setForm({ towers: String(data.pendingContractedTowers || data.contractedTowers), apartments: String(data.pendingContractedApartments || data.contractedApartments) }); }, [data]);
  const act = async (request, message) => { setSaving(true); try { await request(); showToast({ type: "success", message }); await reload(); } catch (requestError) { showToast({ type: "error", message: requestError.message }); } finally { setSaving(false); } };
  const requestUpgrade = (event) => { event.preventDefault(); act(() => communityAdminService.requestUpgrade({ contractedTowers: Number(form.towers), contractedApartments: Number(form.apartments) }), "Upgrade request calculated. Complete the simulated payment to apply it."); };
  return <><PageHeader eyebrow="Plan and billing" title="Community subscription" description="Backend subscription capacity and its development-only simulated payment workflow." />
    <Card><p className="ca-notice"><strong>Development simulation:</strong> Urbanity has no real payment gateway. The actions on this page call explicitly mocked backend endpoints and do not charge money.</p></Card>
    {loading && <LoadingState message="Loading subscription..." />}{error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <div className="ca-grid ca-grid--2"><Card title="Current plan"><dl className="ca-details"><div><dt>Community</dt><dd>{data.communityName}</dd></div><div><dt>Status</dt><dd><Badge variant={data.status === "ACTIVE" ? "success" : "warning"}>{data.status.replaceAll("_", " ")}</Badge></dd></div><div><dt>Tower capacity</dt><dd>{data.contractedTowers}</dd></div><div><dt>Apartment capacity</dt><dd>{data.contractedApartments}</dd></div><div><dt>Plan amount</dt><dd>{money(data.amount)}</dd></div><div><dt>Payment state</dt><dd>{data.paymentStatus}</dd></div></dl>{data.status === "PAYMENT_PENDING" && <Button className="ca-card-action" loading={saving} onClick={() => act(() => communityAdminService.completeMockPayment(), "Simulated activation completed.")}>Complete simulated activation</Button>}</Card>
      <Card title="Increase capacity"><form className="ca-form" onSubmit={requestUpgrade}><Input label="Contracted towers" type="number" min={data.contractedTowers} value={form.towers} onChange={(event) => setForm({ ...form, towers: event.target.value })} required /><Input label="Contracted apartments" type="number" min={data.contractedApartments} value={form.apartments} onChange={(event) => setForm({ ...form, apartments: event.target.value })} required /><Button type="submit" loading={saving} disabled={data.status !== "ACTIVE"}>Calculate upgrade</Button>{data.pendingUpgradeAmount && <div className="ca-upgrade"><p>Pending simulated amount: <strong>{money(data.pendingUpgradeAmount)}</strong></p><Button type="button" loading={saving} onClick={() => act(() => communityAdminService.completeMockUpgrade(), "Simulated upgrade completed.")}>Complete simulated upgrade</Button></div>}</form></Card></div>}
  </>;
}
