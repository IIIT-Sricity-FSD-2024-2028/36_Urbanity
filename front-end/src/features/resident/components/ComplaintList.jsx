import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/ui/index.js";
import { MetricIcon, StatusBadge } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { dateTime, label, locationText, STATUS_LABELS } from "../utils.js";

export function ComplaintList({ complaints, filtered = false }) {
  if (!complaints.length) return <div className="resident-empty">
    <EmptyState title={filtered ? "No matching complaints" : "Everything starts with a report"}
      message={filtered ? "Try a different search or status filter." : "Report a maintenance issue and follow its progress here."} />
    {!filtered && <Link className="ui-button ui-button--primary" to={ROUTES.RESIDENT_NEW_COMPLAINT}>Report an issue</Link>}
  </div>;
  return <ul className="resident-complaint-list" aria-label="Your maintenance complaints">
    {complaints.map((item) => <li key={item.id} className="resident-complaint-row">
      <span className="resident-issue-icon"><MetricIcon name="complaints" /></span>
      <div className="resident-complaint-copy">
        <div className="resident-row-heading">
          <Link className="resident-title-link" to={`${ROUTES.RESIDENT_COMPLAINTS}/${item.id}`}>{item.title}</Link>
          <StatusBadge status={item.status} label={STATUS_LABELS[item.status]} />
        </div>
        <p>{item.description}</p>
        <div className="resident-row-meta"><span>{label(item.requiredWorkType)}</span><span>{locationText(item.location)}</span></div>
        <span className="resident-row-date">Submitted {dateTime(item.createdAt)} · Updated {dateTime(item.updatedAt)}</span>
      </div>
      <Link className="ui-button ui-button--ghost resident-detail-link" to={`${ROUTES.RESIDENT_COMPLAINTS}/${item.id}`} aria-label={`View details for ${item.title}`}>View details <span aria-hidden="true">›</span></Link>
    </li>)}
  </ul>;
}
