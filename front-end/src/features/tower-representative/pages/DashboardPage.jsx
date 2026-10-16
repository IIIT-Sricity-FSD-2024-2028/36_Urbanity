import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Badge, Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { MetricCard, MetricIcon, PageHeader } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { nextAppointmentAction } from "../components/AppointmentTable.jsx";
import { Breakdown } from "../components/Breakdown.jsx";
import { ComplaintTable } from "../components/ComplaintTable.jsx";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { COMPLAINT_STATUSES, RESOLVED_STATUSES, WORKER_STATUSES, countBy, newestFirst } from "../utils/formatters.js";
import { formatVisit } from "../utils/appointments.js";
import { nextAuthorityAction } from "../utils/workflow.js";

const settledValue = (result) => (result.status === "fulfilled" ? result.value : null);

export function DashboardPage() {
  const { user } = useAuth();
  const loader = useCallback(async () => {
    const [hierarchy, complaints] = await Promise.all([
      towerRepresentativeService.getOwnHierarchy(),
      towerRepresentativeService.listComplaints(),
    ]);
    // Secondary panels degrade independently instead of failing the whole dashboard.
    const [workers, appointments] = await Promise.allSettled([
      towerRepresentativeService.listWorkers(),
      towerRepresentativeService.listAppointments(),
    ]);
    return {
      hierarchy,
      complaints,
      workers: settledValue(workers) || [],
      workersFailed: workers.status === "rejected",
      appointments: settledValue(appointments) || [],
      appointmentsFailed: appointments.status === "rejected",
    };
  }, []);
  const { data, error, initialLoading, reload } = useTowerResource(loader);

  const summary = useMemo(() => {
    if (!data) return null;
    const { complaints, workers, appointments } = data;
    const complaintActions = complaints.filter((complaint) => nextAuthorityAction(complaint, user)).map((complaint) => ({
      key: `complaint-${complaint.id}`,
      title: complaint.title,
      detail: complaint.location?.apartmentNumber || "Apartment unavailable",
      label: nextAuthorityAction(complaint, user).label,
      to: `${ROUTES.TOWER_REPRESENTATIVE_COMPLAINTS}/${complaint.id}`,
      at: complaint.createdAt,
      emergency: Boolean(complaint.isEmergency),
    }));
    const appointmentActions = appointments.filter((appointment) => nextAppointmentAction(appointment, user)).map((appointment) => ({
      key: `appointment-${appointment.id}`,
      title: appointment.complaint?.title || "Appointment",
      detail: `Visit · ${appointment.scheduledDate ? formatVisit(appointment.scheduledDate, appointment.scheduledTimeSlot) : formatVisit(appointment.requestedDate, appointment.requestedTimeSlot)}`,
      label: nextAppointmentAction(appointment, user),
      to: `${ROUTES.TOWER_REPRESENTATIVE_APPOINTMENTS}/${appointment.id}`,
      at: appointment.updatedAt,
      emergency: Boolean(appointment.complaint?.isEmergency),
    }));
    const byStatus = countBy(complaints, (complaint) => complaint.status);
    const resolved = complaints.filter((complaint) => RESOLVED_STATUSES.has(complaint.status)).length;
    return {
      byStatus,
      resolved,
      open: complaints.length - resolved,
      actionQueue: [...complaintActions, ...appointmentActions].sort((a, b) => Number(b.emergency) - Number(a.emergency) || new Date(b.at || 0) - new Date(a.at || 0)),
      pendingAppointments: appointments.filter((appointment) => appointment.status === "REQUESTED" || appointment.status === "RESCHEDULE_REQUESTED").length,
      upcomingAppointments: appointments.filter((appointment) => appointment.status === "CONFIRMED").length,
      recent: newestFirst(complaints).slice(0, 6),
      workersByStatus: countBy(workers, (worker) => worker.status),
    };
  }, [data, user]);

  const firstName = data?.hierarchy?.user?.name?.split(" ")[0];
  const tower = data?.hierarchy?.tower;
  const community = data?.hierarchy?.community;

  return (
    <>
      <PageHeader
        eyebrow="Tower workspace"
        title={firstName ? `Welcome back, ${firstName}` : "Tower dashboard"}
        description={tower ? `${tower.name} (${tower.code}) · ${community?.name || "Community unavailable"}` : "Live complaint and workforce activity for your tower."}
        actions={<Link className="ui-button ui-button--primary tr-link-button" to={ROUTES.TOWER_REPRESENTATIVE_COMPLAINTS}>Review complaints</Link>}
      />
      {initialLoading && <LoadingState message="Loading tower dashboard..." />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && summary && (
        <>
          <div className="tr-metrics portal-metrics">
            <MetricCard icon={<MetricIcon name="complaints" />} label="Open complaints" value={summary.open} hint={`${data.complaints.length} total in your tower`} />
            <MetricCard icon={<MetricIcon name="submitted" />} label="New" value={summary.byStatus.SUBMITTED || 0} hint="Submitted, awaiting review" />
            <MetricCard icon={<MetricIcon name="review" />} label="Under review" value={summary.byStatus.UNDER_REVIEW || 0} hint="Ready for assignment" />
            <MetricCard icon={<MetricIcon name="progress" />} label="Work in progress" value={(summary.byStatus.ASSIGNED || 0) + (summary.byStatus.IN_PROGRESS || 0)} hint={`${summary.byStatus.ASSIGNED || 0} assigned · ${summary.byStatus.IN_PROGRESS || 0} in progress`} />
            <MetricCard icon={<MetricIcon name="verification" />} label="Awaiting verification" value={summary.byStatus.PENDING_VERIFICATION || 0} hint="Worker proof submitted" />
            <MetricCard icon={<MetricIcon name="resolved" />} label="Resolved" value={summary.resolved} hint="Resolved, reviewed, or closed" />
            <MetricCard icon={<MetricIcon name="review" />} label="Appointment requests" value={data.appointmentsFailed ? "—" : summary.pendingAppointments} hint={data.appointmentsFailed ? "Appointments unavailable" : `${summary.upcomingAppointments} confirmed visits`} />
          </div>

          <div className="tr-grid tr-grid--2">
            <Card title="Needs your action" actions={<span className="tr-count-pill">{summary.actionQueue.length}</span>}>
              {summary.actionQueue.length ? (
                <ul className="tr-action-list">
                  {summary.actionQueue.slice(0, 6).map((item) => (
                    <li key={item.key}>
                      <div className="tr-cell-stack">
                        <strong>{item.title}</strong>
                        {item.emergency && <span><Badge variant="danger">Emergency</Badge></span>}
                        <span className="tr-muted">{item.detail}</span>
                      </div>
                      <Link className="ui-button ui-button--secondary tr-link-button" to={item.to}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tr-muted">No complaints or appointments currently need your action.</p>
              )}
            </Card>
            <Card title="Complaints by status">
              <Breakdown values={summary.byStatus} order={COMPLAINT_STATUSES} status bars emptyMessage="No complaints have been submitted for your tower." />
            </Card>
          </div>

          <div className="tr-grid tr-grid--2">
            <Card title="Community workforce availability" actions={<Link className="tr-inline-link" to={ROUTES.TOWER_REPRESENTATIVE_WORKFORCE}>View workforce</Link>}>
              {data.workersFailed
                ? <p className="tr-muted">Workforce availability could not be loaded. Refresh the page to try again.</p>
                : <Breakdown values={summary.workersByStatus} order={WORKER_STATUSES} status emptyMessage="No worker profiles exist in your community." />}
            </Card>
            <Card title="Your tower">
              <dl className="tr-details">
                <div><dt>Tower</dt><dd>{tower?.name || "Not available"}</dd></div>
                <div><dt>Tower code</dt><dd>{tower?.code || "Not available"}</dd></div>
                <div><dt>Community</dt><dd>{community?.name || "Not available"}</dd></div>
                <div><dt>Worker profiles</dt><dd>{data.workersFailed ? "Not available" : data.workers.length}</dd></div>
              </dl>
            </Card>
          </div>

          <Card title="Recent complaints" flush actions={<Link className="tr-inline-link" to={ROUTES.TOWER_REPRESENTATIVE_COMPLAINTS}>View all</Link>}>
            <ComplaintTable complaints={summary.recent} user={user} caption="Recent tower complaints" emptyMessage="No complaints have been submitted for your tower." />
          </Card>
        </>
      )}
    </>
  );
}
