import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader } from "../../../components/data-display/index.js";
import { ResidentLocation } from "../components/ResidentLocation.jsx";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";

export function ProfilePage() {
  const { data, loading, error, reload } = useResidentResource(residentService.getHierarchy);
  return <div className="resident-stack">
    <PageHeader title="Resident profile" description="Your account and registered location. Contact your Community Admin to update these details."
      actions={<Button variant="secondary" disabled={loading} onClick={reload}>Refresh</Button>} />
    {loading && <LoadingState message="Loading your profile..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {!loading && !error && (data?.user ? <>
      <Card title="Account details"><dl className="resident-facts">
        {[["Full name", data.user.name], ["Email", data.user.email], ["Phone", data.user.phone], ["Role", "Resident"]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value || "Not provided"}</dd></div>)}
      </dl></Card>
      <ResidentLocation hierarchy={data} />
    </> : <EmptyState title="Profile unavailable" message="Contact your Community Admin to check your account details." />)}
  </div>;
}
