import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, ErrorState, Input, LoadingState, Select } from "../../../components/ui/index.js";
import { PageHeader } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { ComplaintList } from "../components/ComplaintList.jsx";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";
import { COMPLAINT_STATUSES, label, locationText } from "../utils.js";

export function ComplaintsPage() {
  const { data, loading, error, reload } = useResidentResource(residentService.listComplaints);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const query = search.trim().toLowerCase();
  const items = data?.filter((item) => (!status || item.status === status) &&
    [item.id, item.title, item.description, locationText(item.location)].join(" ").toLowerCase().includes(query));
  return <div className="resident-stack">
    <PageHeader title="My complaints" description="Maintenance requests associated with your account."
      actions={<><Button variant="secondary" onClick={reload} disabled={loading}>Refresh</Button><Link className="ui-button ui-button--primary" to={ROUTES.RESIDENT_NEW_COMPLAINT}>Create complaint</Link></>} />
    <Card><div className="resident-grid">
      <Input label="Search complaints" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, ID, description, or location" />
      <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{COMPLAINT_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</Select>
    </div></Card>
    {loading && <LoadingState message="Loading your complaints..." />}
    {error && <ErrorState message={error.message} onRetry={reload} />}
    {items && <Card title={`${items.length} complaint${items.length === 1 ? "" : "s"}`} flush><ComplaintList complaints={[...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))} filtered={Boolean(query || status)} /></Card>}
  </div>;
}
