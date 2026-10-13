import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, ErrorState, Input, LoadingState, Modal, useToast } from "../../../components/ui/index.js";
import { PageHeader, ProfileHero } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { useAsyncResource } from "../hooks/useAsyncResource.js";
import { superAdminService } from "../services/superAdminService.js";

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" /></svg>;
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const loader = useCallback(async () => {
    const [profile, dashboard] = await Promise.all([
      superAdminService.getUser(user.id),
      superAdminService.getDashboard().catch(() => null),
    ]);
    return { profile, dashboard };
  }, [user.id]);
  const { data, loading, error, reload } = useAsyncResource(loader);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.profile) {
      setForm({
        name: data.profile.name || "",
        email: data.profile.email || "",
        phone: data.profile.phone || "",
      });
    }
  }, [data]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await superAdminService.updateUser(user.id, {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      });
      await refreshUser();
      await reload();
      setEditing(false);
      showToast({ type: "success", message: "Profile updated." });
    } catch (requestError) {
      showToast({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  const profile = data?.profile;
  const dashboard = data?.dashboard;
  const userTotal = Object.values(dashboard?.users || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const openComplaints = Object.entries(dashboard?.complaints?.byStatus || {})
    .filter(([status]) => !["RESOLVED", "REVIEWED", "CLOSED"].includes(status))
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);

  return <>
    <PageHeader eyebrow="Platform administration" title="Profile" description="Review your Urbanity platform identity and account access." />
    {loading && <LoadingState message="Loading profile..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {profile && <div className="portal-profile">
      <ProfileHero name={profile.name} email={profile.email} role="Super Admin" />

      <div className="portal-profile__grid">
        <div className="portal-profile__main">
          <section className="portal-profile__card portal-profile__details">
            <header className="portal-profile__section-heading">
              <div><p className="portal-profile__eyebrow">Account details</p><h3>Your platform identity</h3></div>
              <div className="portal-profile__heading-actions"><span>Managed by Urbanity</span><Button variant="secondary" onClick={() => setEditing(true)}>Edit profile</Button></div>
            </header>
            <dl className="portal-profile__detail-list">
              <div><dt>Full name</dt><dd>{profile.name || "Not available"}</dd></div>
              <div><dt>Email address</dt><dd>{profile.email || "Not available"}</dd></div>
              <div><dt>Phone number</dt><dd>{profile.phone || "Not provided"}</dd></div>
              <div><dt>Access level</dt><dd>Super Admin</dd></div>
              <div className="portal-profile__detail-wide"><dt>Account scope</dt><dd>All communities and platform operations</dd></div>
            </dl>
          </section>

          <section className="portal-profile__card portal-profile__activity">
            <header className="portal-profile__section-heading">
              <div><p className="portal-profile__eyebrow">Platform context</p><h3>Your administrative overview</h3></div>
            </header>
            <div className="portal-profile__metric-grid">
              <div><b>{dashboard?.hierarchy?.communities ?? "—"}</b><span>Communities</span></div>
              <div><b>{dashboard ? userTotal : "—"}</b><span>Platform users</span></div>
              <div><b>{dashboard ? openComplaints : "—"}</b><span>Open complaints</span></div>
            </div>
          </section>
        </div>

        <aside className="portal-profile__side">
          <section className="portal-profile__card portal-profile__security">
            <span className="portal-profile__security-icon"><ShieldIcon /></span>
            <div><p className="portal-profile__eyebrow">Session security</p><h3>Secure platform access</h3><p>Your identity and permissions are confirmed by the Urbanity service for this active session.</p></div>
          </section>
          <section className="portal-profile__card portal-profile__actions">
            <p className="portal-profile__eyebrow">Quick actions</p>
            <h3>Continue managing</h3>
            <p>Jump directly to key platform workspaces.</p>
            <Button variant="secondary" onClick={() => navigate(ROUTES.SUPER_ADMIN_COMMUNITIES)}>Manage communities</Button>
            <Button variant="secondary" onClick={() => navigate(ROUTES.SUPER_ADMIN_COMPLAINTS)}>Review complaints</Button>
            <Button variant="secondary" onClick={() => navigate(ROUTES.SUPER_ADMIN_REPORTS)}>Open reports</Button>
          </section>
        </aside>
      </div>
    </div>}

    <Modal
      isOpen={editing}
      onClose={() => !saving && setEditing(false)}
      title="Edit profile"
      footer={<><Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button><Button type="submit" form="super-admin-profile-form" loading={saving}>Save changes</Button></>}
    >
      <form id="super-admin-profile-form" className="sa-form" onSubmit={submit}>
        <Input label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={100} required />
        <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={100} required />
        <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} maxLength={20} />
      </form>
    </Modal>
  </>;
}
