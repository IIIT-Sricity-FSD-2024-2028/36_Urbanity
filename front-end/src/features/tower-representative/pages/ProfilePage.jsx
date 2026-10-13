import { useCallback } from "react";
import { ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader, ProfileHero } from "../../../components/data-display/index.js";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { formatDate } from "../utils/formatters.js";

export function ProfilePage() {
  const loader = useCallback(() => towerRepresentativeService.getOwnHierarchy(), []);
  const { data, error, initialLoading, reload } = useTowerResource(loader);
  const profile = data?.user;

  return <>
    <PageHeader eyebrow="Tower administration" title="Profile" description="Review your Urbanity tower identity and account access." />
    {initialLoading && <LoadingState message="Loading profile..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <div className="portal-profile">
      <ProfileHero name={profile?.name} email={profile?.email} role="Tower Representative" />
      <div className="portal-profile__grid">
        <div className="portal-profile__main">
          <section className="portal-profile__card portal-profile__details">
            <header className="portal-profile__section-heading">
              <div><p className="portal-profile__eyebrow">Account details</p><h3>Your tower identity</h3></div>
              <div className="portal-profile__heading-actions"><span>Read only</span></div>
            </header>
            <dl className="portal-profile__detail-list">
              <div><dt>Full name</dt><dd>{profile?.name || "Not available"}</dd></div>
              <div><dt>Email address</dt><dd>{profile?.email || "Not available"}</dd></div>
              <div><dt>Phone number</dt><dd>{profile?.phone || "Not provided"}</dd></div>
              <div><dt>Access level</dt><dd>Tower Representative</dd></div>
              <div className="portal-profile__detail-wide"><dt>Member since</dt><dd>{formatDate(profile?.createdAt)}</dd></div>
            </dl>
          </section>
        </div>
        <aside className="portal-profile__side">
          <section className="portal-profile__card portal-profile__context">
            <p className="portal-profile__eyebrow">Account scope</p>
            <h3>Tower association</h3>
            <p>Your account and tower association are managed by your Community Admin.</p>
            <dl className="portal-profile__detail-list">
              <div><dt>Assigned tower</dt><dd>{data.tower?.name || "Not available"}</dd></div>
              <div><dt>Tower code</dt><dd>{data.tower?.code || "Not available"}</dd></div>
              <div><dt>Community</dt><dd>{data.community?.name || "Not available"}</dd></div>
              <div><dt>Community address</dt><dd>{data.community?.address || "Not available"}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>}
  </>;
}
