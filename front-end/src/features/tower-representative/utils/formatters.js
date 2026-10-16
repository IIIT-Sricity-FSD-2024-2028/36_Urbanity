export const COMPLAINT_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "PENDING_VERIFICATION",
  "RESOLVED",
  "REVIEWED",
  "CLOSED",
];

// Tower Representatives never see COMMUNITY-type complaints (backend-filtered).
export const COMPLAINT_TYPES = ["APARTMENT", "TOWER"];
export const WORKER_STATUSES = ["AVAILABLE", "BUSY", "ON_LEAVE", "INACTIVE"];
export const RESOLVED_STATUSES = new Set(["RESOLVED", "REVIEWED", "CLOSED"]);
export const ACTIVE_WORK_STATUSES = new Set(["ASSIGNED", "IN_PROGRESS"]);

export function formatEnum(value) {
  if (!value) return "Unknown";
  return String(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Calendar day/month in the viewer's local time zone (ISO timestamps are UTC).
export function localDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatBytes(size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Worker profiles carry no display name, and Tower Representatives cannot read
// the users API, so workers are identified by their profile reference.
export function workerReference(worker) {
  return worker?.userName || "Maintenance worker";
}

export function apartmentLabel(complaint) {
  const location = complaint?.location;
  if (!location) return "Location unavailable";
  return [location.apartmentNumber, location.floorLabel].filter(Boolean).join(" · ") || "Location unavailable";
}

export function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) || "UNKNOWN";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

export function newestFirst(items) {
  return [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function activeWorkload(complaints, workerId) {
  return complaints.filter((complaint) => complaint.assignedWorkerId === workerId && ACTIVE_WORK_STATUSES.has(complaint.status)).length;
}
