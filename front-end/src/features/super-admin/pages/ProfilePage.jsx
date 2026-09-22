import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, ErrorState, Input, LoadingState, useToast } from "../../../components/ui/index.js";
import { PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { useAsyncResource } from "../hooks/useAsyncResource.js";
import { superAdminService } from "../services/superAdminService.js";

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const loader = useCallback(() => superAdminService.getUser(user.id), [user.id]);
  const { data, loading, error, reload } = useAsyncResource(loader);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ name: data.name || "", email: data.email || "", phone: data.phone || "" });
  }, [data]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await superAdminService.updateUser(user.id, { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() });
      await refreshUser();
      await reload();
      showToast({ type: "success", message: "Profile updated." });
    } catch (requestError) {
      showToast({ type: "error", message: requestError.message });
    } finally { setSaving(false); }
  };

  return <>
    <PageHeader eyebrow="Account" title="My profile" description="Update the contact details supported by the user API." />
    {loading && <LoadingState message="Loading profile..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {data && <div className="sa-grid sa-grid--2">
      <Card title="Account details"><dl className="sa-details"><div><dt>Role</dt><dd><StatusBadge status={data.role} label="Super Admin" /></dd></div><div><dt>User ID</dt><dd>{data.id}</dd></div></dl></Card>
      <Card title="Contact information">
        <form className="sa-form" onSubmit={submit}>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Button type="submit" loading={saving}>Save profile</Button>
        </form>
      </Card>
    </div>}
  </>;
}
