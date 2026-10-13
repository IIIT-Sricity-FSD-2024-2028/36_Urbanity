import { Button, EmptyState, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader, ProfileHero } from "../../../components/data-display/index.js";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";

export function ProfilePage() {
  const { data, loading, error, reload } = useResidentResource(residentService.getHierarchy);
  const profile = data?.user;

  return <>
    <PageHeader eyebrow="Resident account" title="Profile" description="Review your Urbanity resident identity and registered apartment."
      actions={<Button variant="secondary" disabled={loading} onClick={reload}>Refresh</Button>} />
    {loading && <LoadingState message="Loading your profile..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {!loading && !error && (profile ? <div className="portal-profile">
      <ProfileHero name={profile.name} email={profile.email} role="Resident" />
      <div className="portal-profile__grid">
        <div className="portal-profile__main">
          <section className="portal-profile__card portal-profile__details">
            <header className="portal-profile__section-heading">
              <div><p className="portal-profile__eyebrow">Account details</p><h3>Your resident identity</h3></div>
              <div className="portal-profile__heading-actions"><span>Read only</span></div>
            </header>
            <dl className="portal-profile__detail-list">
              <div><dt>Full name</dt><dd>{profile.name || "Not available"}</dd></div>
              <div><dt>Email address</dt><dd>{profile.email || "Not available"}</dd></div>
              <div><dt>Phone number</dt><dd>{profile.phone || "Not provided"}</dd></div>
              <div><dt>Access level</dt><dd>Resident</dd></div>
            </dl>
          </section>
        </div>
        <aside className="portal-profile__side">
          <section className="portal-profile__card portal-profile__context">
            <p className="portal-profile__eyebrow">Registered location</p>
            <h3>Your apartment</h3>
            <p>Your account and apartment association are managed by your Community Admin.</p>
            <dl className="portal-profile__detail-list">
              <div><dt>Community</dt><dd>{data.community?.name || "Not available"}</dd></div>
              <div><dt>Tower</dt><dd>{data.tower?.name || "Not available"}</dd></div>
              <div><dt>Floor</dt><dd>{data.floor?.label ?? data.floor?.floorNumber ?? "Not available"}</dd></div>
              <div><dt>Apartment</dt><dd>{data.apartment?.label || data.apartment?.apartmentNumber || "Not available"}</dd></div>
              <div><dt>Address</dt><dd>{data.community?.address || "Not available"}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div> : <EmptyState title="Profile unavailable" message="Contact your Community Admin to check your account details." />)}
  </>;
}
