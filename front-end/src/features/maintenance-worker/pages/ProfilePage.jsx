import { useAuth } from "../../../auth/useAuth.js";
import { Button, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader, ProfileHero, RatingStars, StatusBadge } from "../../../components/data-display/index.js";
import { useWorkerResource } from "../hooks/useWorkerResource.js";
import { maintenanceWorkerService as service } from "../services/maintenanceWorkerService.js";
import { formatDate, formatLabel } from "../utils/workflow.js";

export function ProfilePage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useWorkerResource(service.getProfile);
  const displayName = data?.name || user?.email?.split("@")[0];

  return <>
    <PageHeader eyebrow="Maintenance account" title="Profile" description="Review your Urbanity worker identity and service status."
      actions={<Button variant="secondary" loading={loading} onClick={reload}>Refresh</Button>} />
    {loading && <LoadingState message="Loading worker profile..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && !error && <div className="portal-profile">
      <ProfileHero name={displayName} email={user?.email} role="Maintenance Worker" />
      <div className="portal-profile__grid">
        <div className="portal-profile__main">
          <section className="portal-profile__card portal-profile__details">
            <header className="portal-profile__section-heading">
              <div><p className="portal-profile__eyebrow">Worker details</p><h3>Your service identity</h3></div>
              <div className="portal-profile__heading-actions"><span>Community managed</span></div>
            </header>
            <dl className="portal-profile__detail-list">
              <div><dt>Email address</dt><dd>{user?.email || "Not available"}</dd></div>
              <div><dt>Access level</dt><dd>Maintenance Worker</dd></div>
              <div><dt>Specialization</dt><dd>{formatLabel(data.specialization)}</dd></div>
              <div><dt>Created</dt><dd>{formatDate(data.createdAt)}</dd></div>
              <div><dt>Updated</dt><dd>{formatDate(data.updatedAt)}</dd></div>
            </dl>
          </section>
        </div>
        <aside className="portal-profile__side">
          <section className="portal-profile__card portal-profile__context">
            <p className="portal-profile__eyebrow">Work context</p>
            <h3>Community service profile</h3>
            <p>Your specialization, availability, and work history are managed within your community.</p>
            <dl className="portal-profile__detail-list">
              <div><dt>Community</dt><dd>Your assigned community</dd></div>
              <div><dt>Work status</dt><dd><StatusBadge status={data.status} /></dd></div>
              <div><dt>Rating</dt><dd><RatingStars value={data.rating} /></dd></div>
              <div><dt>Reviewed completed work</dt><dd>{data.completedWorkCount ?? "Not available"}</dd></div>
              <div><dt>Verified work history</dt><dd>{Array.isArray(data.workHistory) ? data.workHistory.length : "Not available"}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>}
  </>;
}
