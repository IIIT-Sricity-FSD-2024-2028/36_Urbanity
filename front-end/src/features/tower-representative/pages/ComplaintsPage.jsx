import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, ErrorState, Input, LoadingState, Select } from "../../../components/ui/index.js";
import { PageHeader } from "../../../components/data-display/index.js";
import { ComplaintTable } from "../components/ComplaintTable.jsx";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { COMPLAINT_STATUSES, COMPLAINT_TYPES, RESOLVED_STATUSES, formatEnum, localDateKey, newestFirst } from "../utils/formatters.js";
import { emergencyFirst } from "../utils/appointments.js";
import { nextAuthorityAction } from "../utils/workflow.js";

const ACTION_REQUIRED = "ACTION_REQUIRED";

export function ComplaintsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const statusParam = searchParams.get("status") || "";
  const status = statusParam === ACTION_REQUIRED || COMPLAINT_STATUSES.includes(statusParam) ? statusParam : "";

  const loader = useCallback(() => towerRepresentativeService.listComplaints(), []);
  const { data, error, initialLoading, loading, reload } = useTowerResource(loader);

  const setStatus = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("status", value); else next.delete("status");
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return emergencyFirst(newestFirst((data || []).filter((complaint) => {
      if (status === ACTION_REQUIRED ? !nextAuthorityAction(complaint, user) : status && complaint.status !== status) return false;
      if (type && complaint.type !== type) return false;
      if (fromDate && localDateKey(complaint.createdAt) < fromDate) return false;
      if (!query) return true;
      const haystack = [complaint.title, complaint.description, complaint.location?.apartmentNumber, complaint.location?.floorLabel]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    })), (complaint) => (RESOLVED_STATUSES.has(complaint.status) ? null : complaint));
  }, [data, fromDate, search, status, type, user]);

  const hasFilters = Boolean(search || type || fromDate || status);
  const clearFilters = () => { setSearch(""); setType(""); setFromDate(""); setStatus(""); };

  return (
    <>
      <PageHeader
        eyebrow="Tower operations"
        title="Complaints"
        description="Apartment and tower complaints within your tower. Community-wide complaints are handled by the Community Admin."
        actions={<Button variant="secondary" onClick={reload} loading={loading && Boolean(data)} loadingLabel="Refreshing...">Refresh</Button>}
      />
      <Card className="tr-filters">
        <div className="tr-filter-row">
          <Input label="Search" type="search" placeholder="Title, apartment, or floor" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value={ACTION_REQUIRED}>Needs my action</option>
            {COMPLAINT_STATUSES.map((item) => <option key={item} value={item}>{formatEnum(item)}</option>)}
          </Select>
          <Select label="Type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All types</option>
            {COMPLAINT_TYPES.map((item) => <option key={item} value={item}>{formatEnum(item)}</option>)}
          </Select>
          <Input label="Created from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </div>
        {hasFilters && data && (
          <div className="tr-filter-summary">
            <span className="tr-muted">Showing {filtered.length} of {data.length} complaints</span>
            <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>
          </div>
        )}
      </Card>
      {initialLoading && <LoadingState message="Loading complaints..." />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && (
        <Card flush>
          <ComplaintTable
            complaints={filtered}
            user={user}
            caption="Tower complaints"
            emptyTitle={data.length ? "No matching complaints" : "No complaints"}
            emptyMessage={data.length ? "Adjust or clear the filters to see more complaints." : "No complaints have been submitted for your tower."}
          />
        </Card>
      )}
    </>
  );
}
