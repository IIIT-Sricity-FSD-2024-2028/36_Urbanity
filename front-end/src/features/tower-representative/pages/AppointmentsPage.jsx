import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, ErrorState, Input, LoadingState } from "../../../components/ui/index.js";
import { MetricCard, PageHeader } from "../../../components/data-display/index.js";
import { AppointmentTable } from "../components/AppointmentTable.jsx";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { APPOINTMENT_VIEWS, appointmentView, emergencyFirst, visitSortKey } from "../utils/appointments.js";
import { apartmentLabel } from "../utils/formatters.js";

const EMPTY_MESSAGES = {
  PENDING: "No appointment requests are waiting for your decision.",
  UPCOMING: "No confirmed visits are scheduled.",
  COMPLETED: "No visits have been completed yet.",
  CANCELLED: "No appointments have been cancelled.",
  MISSED: "No visits have been missed.",
};

export function AppointmentsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const viewParam = searchParams.get("view");
  const view = APPOINTMENT_VIEWS.some((item) => item.value === viewParam) ? viewParam : "PENDING";

  const loader = useCallback(() => towerRepresentativeService.listAppointments(), []);
  const { data, error, initialLoading, loading, reload } = useTowerResource(loader);

  const counts = useMemo(() => (data || []).reduce((totals, item) => {
    const key = appointmentView(item);
    totals[key] = (totals[key] || 0) + 1;
    return totals;
  }, {}), [data]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = (data || []).filter((item) => appointmentView(item) === view && (!query ||
      [item.complaint?.title, apartmentLabel(item.complaint), item.workerName].filter(Boolean).join(" ").toLowerCase().includes(query)));
    // Pending and upcoming read soonest-first; closed views read most-recent-first.
    const ascending = view === "PENDING" || view === "UPCOMING";
    const ordered = matching.sort((a, b) => (ascending ? 1 : -1) * visitSortKey(a).localeCompare(visitSortKey(b)));
    // Emergencies lead the actionable views.
    return ascending ? emergencyFirst(ordered) : ordered;
  }, [data, search, view]);

  const setView = (value) => {
    const next = new URLSearchParams(searchParams);
    next.set("view", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="Tower operations"
        title="Appointments"
        description="Resident visit requests for complaints in your tower. Confirm visits with an eligible worker and process reschedule requests."
        actions={<Button variant="secondary" onClick={reload} loading={loading && Boolean(data)} loadingLabel="Refreshing...">Refresh</Button>}
      />
      {data && (
        <div className="tr-metrics">
          {APPOINTMENT_VIEWS.map((item) => <MetricCard key={item.value} label={item.label} value={counts[item.value] || 0} />)}
        </div>
      )}
      <Card className="tr-filters">
        <div className="tr-appointment-toolbar">
          <div className="tr-segmented" role="group" aria-label="Appointment view">
            {APPOINTMENT_VIEWS.map((item) => (
              <button key={item.value} type="button" className={`tr-segmented__option${view === item.value ? " tr-segmented__option--active" : ""}`} aria-pressed={view === item.value} onClick={() => setView(item.value)}>
                {item.label}{data ? ` (${counts[item.value] || 0})` : ""}
              </button>
            ))}
          </div>
          <Input label="Search" type="search" placeholder="Complaint, apartment, or worker" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </Card>
      {initialLoading && <LoadingState message="Loading appointments..." />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && (
        <Card flush>
          <AppointmentTable
            appointments={rows}
            user={user}
            caption={`${APPOINTMENT_VIEWS.find((item) => item.value === view).label} appointments`}
            emptyTitle={search ? "No matching appointments" : "No appointments"}
            emptyMessage={search ? "Adjust or clear the search to see more appointments." : EMPTY_MESSAGES[view]}
          />
        </Card>
      )}
    </>
  );
}
