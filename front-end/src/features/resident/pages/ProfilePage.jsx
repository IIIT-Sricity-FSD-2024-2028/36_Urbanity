import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader } from "../../../components/data-display/index.js";
import { ResidentLocation } from "../components/ResidentLocation.jsx";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";

export function ProfilePage() {
  const { data, loading, error, reload } = useResidentResource(residentService.getHierarchy);
  const profile = data?.user;
  return <div className="resident-stack">
    <PageHeader title="Your profile" description="Your account and the place you call home."
      actions={<Button variant="secondary" disabled={loading} onClick={reload}>Refresh</Button>} />
    {loading && <LoadingState message="Loading your profile..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {!loading && !error && (profile ? <>
      <section className="resident-profile-banner">
        <span className="resident-avatar" aria-hidden="true">{profile.name?.trim().slice(0, 1).toUpperCase() || "R"}</span>
        <div><h2>{profile.name || "Resident"}</h2><p>{profile.email}</p><span className="resident-account-label">Resident account</span></div>
      </section>
      <div className="resident-form-layout">
        <Card title="Account details"><dl className="resident-facts">
          {[["Full name", profile.name], ["Email address", profile.email], ["Phone number", profile.phone], ["Access level", "Resident"]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value || "Not provided"}</dd></div>)}
        </dl><p className="resident-note resident-account-note">Need to update your details? Contact your Community Admin. Your account and apartment association are managed by them.</p></Card>
        <ResidentLocation hierarchy={data} />
      </div>
    </> : <EmptyState title="Profile unavailable" message="Contact your Community Admin to check your account details." />)}
  </div>;
}
