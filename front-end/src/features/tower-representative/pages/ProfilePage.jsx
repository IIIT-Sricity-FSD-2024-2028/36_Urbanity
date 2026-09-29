import { useCallback } from "react";
import { Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { formatDate } from "../utils/formatters.js";

// Profile editing (PATCH /users/:id) is restricted to Super Admin and Community
// Admin, so this page is read-only.
export function ProfilePage() {
  const loader = useCallback(() => towerRepresentativeService.getOwnHierarchy(), []);
  const { data, error, initialLoading, reload } = useTowerResource(loader);
  const profile = data?.user;

  return (
    <>
      <PageHeader eyebrow="Account" title="My profile" description="Your authenticated account and tower association." />
      {initialLoading && <LoadingState message="Loading profile..." />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && (
        <div className="tr-grid tr-grid--2">
          <Card title="Account details">
            <dl className="tr-details">
              <div><dt>Name</dt><dd>{profile?.name || "Not available"}</dd></div>
              <div><dt>Email</dt><dd>{profile?.email || "Not available"}</dd></div>
              <div><dt>Phone</dt><dd>{profile?.phone || "Not provided"}</dd></div>
              <div><dt>Role</dt><dd><StatusBadge status={profile?.role} label="Tower Representative" /></dd></div>
              <div><dt>Member since</dt><dd>{formatDate(profile?.createdAt)}</dd></div>
            </dl>
          </Card>
          <Card title="Tower association">
            <dl className="tr-details">
              <div><dt>Assigned tower</dt><dd>{data.tower?.name || "Not available"}</dd></div>
              <div><dt>Tower code</dt><dd>{data.tower?.code || "Not available"}</dd></div>
              <div><dt>Community</dt><dd>{data.community?.name || "Not available"}</dd></div>
              <div><dt>Community address</dt><dd>{data.community?.address || "Not available"}</dd></div>
            </dl>
          </Card>
          <p className="tr-muted tr-note tr-grid__wide">
            Account details and tower association are managed by your Community Admin. Contact them to request changes.
          </p>
        </div>
      )}
    </>
  );
}
