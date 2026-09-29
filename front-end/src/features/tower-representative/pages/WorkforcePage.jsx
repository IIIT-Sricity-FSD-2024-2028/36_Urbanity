import { useCallback, useMemo, useState } from "react";
import { Button, Card, ErrorState, Input, LoadingState, Select } from "../../../components/ui/index.js";
import { DataTable, MetricCard, PageHeader, StatusBadge } from "../../../components/data-display/index.js";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { WORKER_STATUSES, activeWorkload, countBy, formatEnum, formatRating, workerReference } from "../utils/formatters.js";

export function WorkforcePage() {
  const loader = useCallback(async () => {
    const [workers, complaints] = await Promise.all([
      towerRepresentativeService.listWorkers(),
      towerRepresentativeService.listComplaints(),
    ]);
    return { workers, complaints };
  }, []);
  const { data, error, initialLoading, loading, reload } = useTowerResource(loader);
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [status, setStatus] = useState("");

  const specializations = useMemo(
    () => [...new Set((data?.workers || []).map((worker) => worker.specialization).filter(Boolean))].sort(),
    [data],
  );
  const byStatus = useMemo(() => countBy(data?.workers || [], (worker) => worker.status), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.workers
      .filter((worker) => !specialization || worker.specialization === specialization)
      .filter((worker) => !status || worker.status === status)
      .filter((worker) => !query || [workerReference(worker), worker.id, formatEnum(worker.specialization)].join(" ").toLowerCase().includes(query))
      .map((worker) => ({ ...worker, towerWorkload: activeWorkload(data.complaints, worker.id) }));
  }, [data, search, specialization, status]);

  const columns = [
    { key: "id", header: "Worker profile", render: (_, row) => <strong>{workerReference(row)}</strong> },
    { key: "specialization", header: "Specialization", render: formatEnum },
    { key: "status", header: "Availability", render: (value) => <StatusBadge status={value} /> },
    { key: "rating", header: "Rating", render: formatRating },
    { key: "completedWorkCount", header: "Completed work", render: (value) => value || 0 },
    { key: "towerWorkload", header: "Active tasks in your tower" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Shared workforce"
        title="Maintenance workforce"
        description="Community-scoped worker profiles available for eligible complaint assignments. Profiles are managed by the Community Admin."
        actions={<Button variant="secondary" onClick={reload} loading={loading && Boolean(data)} loadingLabel="Refreshing...">Refresh</Button>}
      />
      {initialLoading && <LoadingState message="Loading workforce..." />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && (
        <>
          <div className="tr-metrics">
            <MetricCard icon="W" label="Worker profiles" value={data.workers.length} />
            {WORKER_STATUSES.map((item) => (
              <MetricCard key={item} label={formatEnum(item)} value={byStatus[item] || 0} />
            ))}
          </div>
          <Card className="tr-filters">
            <div className="tr-filter-row">
              <Input label="Search" type="search" placeholder="Worker reference or specialization" value={search} onChange={(event) => setSearch(event.target.value)} />
              <Select label="Specialization" value={specialization} onChange={(event) => setSpecialization(event.target.value)}>
                <option value="">All specializations</option>
                {specializations.map((item) => <option key={item} value={item}>{formatEnum(item)}</option>)}
              </Select>
              <Select label="Availability" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All availability</option>
                {WORKER_STATUSES.map((item) => <option key={item} value={item}>{formatEnum(item)}</option>)}
              </Select>
            </div>
          </Card>
          <Card flush>
            <DataTable
              rows={rows}
              columns={columns}
              caption="Community maintenance workforce"
              emptyTitle={data.workers.length ? "No matching workers" : "No worker profiles"}
              emptyMessage={data.workers.length ? "Adjust the filters to see more worker profiles." : "Your community has no maintenance worker profiles yet."}
            />
          </Card>
          <p className="tr-muted tr-note">
            Worker names are not shown because worker profiles do not include them and the users API is not available to Tower Representatives.
          </p>
        </>
      )}
    </>
  );
}
