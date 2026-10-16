import { useCallback, useMemo, useState } from "react";
import { Button, Card, ErrorState, LoadingState, Select } from "../../../components/ui/index.js";
import { DataTable, MetricCard, PageHeader } from "../../../components/data-display/index.js";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { RESOLVED_STATUSES } from "../utils/formatters.js";

// The backend exposes no tower resident listing for this role. Residents are
// resolved from complaint records through the tower-scoped resident-hierarchy API.
async function loadResidents() {
  const [hierarchy, complaints] = await Promise.all([
    towerRepresentativeService.getOwnHierarchy(),
    towerRepresentativeService.listComplaints(),
  ]);
  const residentIds = [...new Set(complaints.map((complaint) => complaint.residentId).filter(Boolean))];
  const results = await Promise.allSettled(residentIds.map((id) => towerRepresentativeService.getResidentHierarchy(id)));

  const residents = residentIds.map((id, index) => {
    const context = results[index].status === "fulfilled" ? results[index].value : null;
    const residentComplaints = complaints.filter((complaint) => complaint.residentId === id);
    const fallbackLocation = residentComplaints[0]?.location;
    return {
      id,
      name: context?.user?.name || "Resident details unavailable",
      email: context?.user?.email || "",
      phone: context?.user?.phone || "",
      apartment: context?.apartment?.apartmentNumber || fallbackLocation?.apartmentNumber || "Not available",
      floor: context?.floor?.label || fallbackLocation?.floorLabel || "Not available",
      floorNumber: context?.floor?.floorNumber ?? Number.MAX_SAFE_INTEGER,
      total: residentComplaints.length,
      open: residentComplaints.filter((complaint) => !RESOLVED_STATUSES.has(complaint.status)).length,
    };
  }).sort((a, b) => a.floorNumber - b.floorNumber || a.apartment.localeCompare(b.apartment));

  return { hierarchy, residents, unresolved: results.filter((result) => result.status === "rejected").length };
}

export function ResidentsPage() {
  const loader = useCallback(() => loadResidents(), []);
  const { data, error, initialLoading, loading, reload } = useTowerResource(loader);
  const [floor, setFloor] = useState("");

  const floors = useMemo(() => [...new Set((data?.residents || []).map((resident) => resident.floor))], [data]);
  const rows = useMemo(() => (data?.residents || []).filter((resident) => !floor || resident.floor === floor), [data, floor]);

  const columns = [
    {
      key: "name",
      header: "Resident",
      render: (value, row) => (
        <div className="tr-cell-stack">
          <strong>{value}</strong>
          {row.email && <span className="tr-muted">{row.email}</span>}
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (value) => value || "Not provided" },
    { key: "apartment", header: "Apartment" },
    { key: "floor", header: "Floor" },
    { key: "total", header: "Complaints", render: (value, row) => `${value} total · ${row.open} open` },
  ];

  const tower = data?.hierarchy?.tower;
  const community = data?.hierarchy?.community;

  return (
    <>
      <PageHeader
        eyebrow="Tower directory"
        title="Tower & residents"
        description="Your tower association and the residents linked to complaints in your tower."
        actions={<Button variant="secondary" onClick={reload} loading={loading && Boolean(data)} loadingLabel="Refreshing...">Refresh</Button>}
      />
      {initialLoading && <LoadingState message="Loading tower residents..." />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && (
        <>
          <div className="tr-grid tr-grid--2">
            <Card title="Assigned tower">
              <dl className="tr-details">
                <div><dt>Tower name</dt><dd>{tower?.name || "Not available"}</dd></div>
                <div><dt>Tower code</dt><dd>{tower?.code || "Not available"}</dd></div>
                <div><dt>Community</dt><dd>{community?.name || "Not available"}</dd></div>
                <div><dt>Community address</dt><dd>{community?.address || "Not available"}</dd></div>
              </dl>
            </Card>
            <div className="tr-metrics tr-metrics--compact">
              <MetricCard label="Residents with complaints" value={data.residents.length} />
              <MetricCard label="Floors represented" value={floors.filter((item) => item !== "Not available").length} />
              <MetricCard label="Apartments represented" value={new Set(data.residents.map((resident) => resident.apartment).filter((item) => item !== "Not available")).size} />
            </div>
          </div>

          <Card
            title="Residents linked to tower complaints"
            flush
            actions={floors.length > 1 && (
              <Select aria-label="Filter residents by floor" value={floor} onChange={(event) => setFloor(event.target.value)}>
                <option value="">All floors</option>
                {floors.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            )}
          >
            <DataTable
              rows={rows}
              columns={columns}
              caption="Residents linked to tower complaints"
              emptyTitle="No residents to show"
              emptyMessage="Residents appear here once they submit a complaint in your tower."
            />
          </Card>
          <p className="tr-muted tr-note">
            A complete floor, apartment, and occupancy directory is not available to Tower Representatives; only residents linked to your tower's complaints are shown.
            {data.unresolved > 0 && ` Details for ${data.unresolved} resident${data.unresolved === 1 ? "" : "s"} could not be loaded.`}
          </p>
        </>
      )}
    </>
  );
}
