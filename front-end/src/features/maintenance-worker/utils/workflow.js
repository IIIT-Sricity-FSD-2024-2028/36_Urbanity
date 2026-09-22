export const VERIFIED_STATUSES = ["RESOLVED", "REVIEWED", "CLOSED"];
export const COMPLETED_STATUSES = ["PENDING_VERIFICATION", ...VERIFIED_STATUSES];
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function validateProofFile(file) {
  if (!file) return "Choose a proof image.";
  if (!IMAGE_TYPES.includes(file.type)) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size > MAX_IMAGE_SIZE) return "Each image must be 5 MB or smaller.";
  if (file.size === 0) return "The selected file is empty.";
  return "";
}

export function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

export const formatLabel = (value) => value ? String(value).replaceAll("_", " ") : "Not available";
export function locationLabel(task) {
  const location = task.location;
  return location ? [location.communityName, location.towerName, location.floorLabel, location.apartmentNumber].filter(Boolean).join(" / ") || "Not available" : "Not available";
}

export function matchesTask(task, query) {
  const text = [task.id, task.title, task.description, task.requiredWorkType, locationLabel(task)].filter(Boolean).join(" ");
  return text.toLowerCase().includes(query.trim().toLowerCase());
}
