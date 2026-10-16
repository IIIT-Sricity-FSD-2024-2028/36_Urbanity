import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, ErrorState, Input, LoadingState, Modal, useToast } from "../../../components/ui/index.js";
import { PageHeader, ProfileHero } from "../../../components/data-display/index.js";
import { useCommunityResource } from "../hooks/useCommunityResource.js";
import { communityAdminService } from "../services/communityAdminService.js";

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const loader = useCallback(() => communityAdminService.getUser(user.id), [user.id]);
  const { data, loading, error, reload } = useCommunityResource(loader);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ name: data.name || "", email: data.email || "", phone: data.phone || "", password: "" });
  }, [data]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() };
      if (data.registrationApplicationId) delete payload.email;
      if (form.password) payload.password = form.password;
      await communityAdminService.updateUser(user.id, payload);
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

  return <>
    <PageHeader eyebrow="Community administration" title="Profile" description="Review your Urbanity community identity and account access." />
    {loading && <LoadingState message="Loading profile..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <div className="portal-profile">
      <ProfileHero name={data.name} email={data.email} role="Community Admin" />
      <div className="portal-profile__grid">
        <div className="portal-profile__main">
          <section className="portal-profile__card portal-profile__details">
            <header className="portal-profile__section-heading">
              <div><p className="portal-profile__eyebrow">Account details</p><h3>Your community identity</h3></div>
              <div className="portal-profile__heading-actions"><span>Community scoped</span><Button variant="secondary" onClick={() => setEditing(true)}>Edit profile</Button></div>
            </header>
            <dl className="portal-profile__detail-list">
              <div><dt>Full name</dt><dd>{data.name || "Not available"}</dd></div>
              <div><dt>Email address</dt><dd>{data.email || "Not available"}</dd></div>
              <div><dt>Phone number</dt><dd>{data.phone || "Not provided"}</dd></div>
              <div><dt>Access level</dt><dd>Community Admin</dd></div>
            </dl>
          </section>
        </div>
        <aside className="portal-profile__side">
          <section className="portal-profile__card portal-profile__context">
            <p className="portal-profile__eyebrow">Account scope</p>
            <h3>Community operations</h3>
            <p>Your permissions and community association are determined by the Urbanity service.</p>
            <dl className="portal-profile__detail-list">
              <div><dt>Community scope</dt><dd>Your managed community</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>}

    <Modal
      isOpen={editing}
      onClose={() => !saving && setEditing(false)}
      title="Edit profile"
      footer={<><Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button><Button type="submit" form="community-admin-profile-form" loading={saving}>Save changes</Button></>}
    >
      <form id="community-admin-profile-form" className="ca-form" onSubmit={submit}>
        <Input label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <Input label="Email" readOnly={Boolean(data?.registrationApplicationId)} hint={data?.registrationApplicationId ? "Registration email is linked to your approved application." : undefined} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <Input label="New password" hint={data?.registrationApplicationId ? "Leave blank to keep the current password. You can replace your default password here." : "Leave blank to keep the current password."} type="password" autoComplete="new-password" minLength="8" maxLength="128" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
      </form>
    </Modal>
  </>;
}
