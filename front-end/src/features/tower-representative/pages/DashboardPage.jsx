import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Card, ErrorState, LoadingState } from "../../../components/ui/index.js";
import { MetricCard, PageHeader } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { Breakdown } from "../components/Breakdown.jsx";
import { ComplaintTable } from "../components/ComplaintTable.jsx";
import { useTowerResource } from "../hooks/useTowerResource.js";
import { towerRepresentativeService } from "../services/towerRepresentativeService.js";
import { COMPLAINT_STATUSES, RESOLVED_STATUSES, WORKER_STATUSES, countBy, newestFirst } from "../utils/formatters.js";
import { nextAuthorityAction } from "../utils/workflow.js";

export function DashboardPage() {
  const { user } = useAuth();
  const loader = useCallback(async () => {
    const [hierarchy, complaints, workers] = await Promise.all([
      towerRepresentativeService.getOwnHierarchy(),
      towerRepresentativeService.listComplaints(),
      towerRepresentativeService.listWorkers(),
    ]);
    return { hierarchy, complaints, workers };
  }, []);
  const { data, error, initialLoading, reload } = useTowerResource(loader);

  const summary = useMemo(() => {
    if (!data) return null;
    const { complaints, workers } = data;
    const byStatus = countBy(complaints, (complaint) => complaint.status);
    const resolved = complaints.filter((complaint) => RESOLVED_STATUSES.has(complaint.status)).length;
    return {
      byStatus,
      resolved,
      open: complaints.length - resolved,
      actionQueue: newestFirst(complaints.filter((complaint) => nextAuthorityAction(complaint, user))),
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
          <div className="tr-metrics">
            <MetricCard icon="!" label="Open complaints" value={summary.open} hint={`${data.complaints.length} total in your tower`} />
            <MetricCard icon="N" label="New" value={summary.byStatus.SUBMITTED || 0} hint="Submitted, awaiting review" />
            <MetricCard icon="R" label="Under review" value={summary.byStatus.UNDER_REVIEW || 0} hint="Ready for assignment" />
            <MetricCard icon="W" label="Work in progress" value={(summary.byStatus.ASSIGNED || 0) + (summary.byStatus.IN_PROGRESS || 0)} hint={`${summary.byStatus.ASSIGNED || 0} assigned · ${summary.byStatus.IN_PROGRESS || 0} in progress`} />
            <MetricCard icon="V" label="Awaiting verification" value={summary.byStatus.PENDING_VERIFICATION || 0} hint="Worker proof submitted" />
            <MetricCard icon="✓" label="Resolved" value={summary.resolved} hint="Resolved, reviewed, or closed" />
          </div>

          <div className="tr-grid tr-grid--2">
            <Card title="Needs your action" actions={<span className="tr-count-pill">{summary.actionQueue.length}</span>}>
              {summary.actionQueue.length ? (
                <ul className="tr-action-list">
                  {summary.actionQueue.slice(0, 5).map((complaint) => (
                    <li key={complaint.id}>
                      <div className="tr-cell-stack">
                        <strong>{complaint.title}</strong>
                        <span className="tr-muted">{complaint.location?.apartmentNumber || "Apartment unavailable"}</span>
                      </div>
                      <Link className="ui-button ui-button--secondary tr-link-button" to={`${ROUTES.TOWER_REPRESENTATIVE_COMPLAINTS}/${complaint.id}`}>
                        {nextAuthorityAction(complaint, user).label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tr-muted">No complaints currently need your action.</p>
              )}
            </Card>
            <Card title="Complaints by status">
              <Breakdown values={summary.byStatus} order={COMPLAINT_STATUSES} status bars emptyMessage="No complaints have been submitted for your tower." />
            </Card>
          </div>

          <div className="tr-grid tr-grid--2">
            <Card title="Community workforce availability" actions={<Link className="tr-inline-link" to={ROUTES.TOWER_REPRESENTATIVE_WORKFORCE}>View workforce</Link>}>
              <Breakdown values={summary.workersByStatus} order={WORKER_STATUSES} status emptyMessage="No worker profiles exist in your community." />
            </Card>
            <Card title="Your tower">
              <dl className="tr-details">
                <div><dt>Tower</dt><dd>{tower?.name || "Not available"}</dd></div>
                <div><dt>Tower code</dt><dd>{tower?.code || "Not available"}</dd></div>
                <div><dt>Community</dt><dd>{community?.name || "Not available"}</dd></div>
                <div><dt>Worker profiles</dt><dd>{data.workers.length}</dd></div>
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
