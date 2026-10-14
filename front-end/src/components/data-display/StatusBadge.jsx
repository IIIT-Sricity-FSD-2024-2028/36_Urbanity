import { Badge } from "../ui/Badge.jsx";

const STATUS_VARIANTS = {
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  ASSIGNED: "info",
  IN_PROGRESS: "info",
  PENDING_VERIFICATION: "warning",
  RESOLVED: "success",
  REVIEWED: "success",
  CLOSED: "neutral",
  AVAILABLE: "success",
  BUSY: "warning",
  ON_LEAVE: "neutral",
  INACTIVE: "neutral",
};

export function StatusBadge({ status, label, ...props }) {
  const normalizedStatus = String(status || "").toUpperCase();
  const displayLabel = label || ({
    SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", ASSIGNED: "Worker assigned",
    IN_PROGRESS: "Work in progress", PENDING_VERIFICATION: "Awaiting verification",
    RESOLVED: "Resolution verified", REVIEWED: "Feedback received", CLOSED: "Closed",
  })[normalizedStatus] || (normalizedStatus ? normalizedStatus.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : "Unknown");

  return (
    <Badge {...props} variant={STATUS_VARIANTS[normalizedStatus] || "neutral"}>
      {displayLabel}
    </Badge>
  );
}
