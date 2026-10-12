export const COMPLAINT_TYPES = ["APARTMENT", "TOWER", "COMMUNITY"];
export const WORK_TYPES = ["PLUMBING", "ELECTRICAL", "CARPENTRY", "HVAC", "LIFT_MAINTENANCE", "CLEANING", "GENERAL_MAINTENANCE"];
export const COMPLAINT_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "PENDING_VERIFICATION", "RESOLVED", "REVIEWED", "CLOSED"];
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function validateImages(files) {
  for (const file of files) {
    if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: choose a JPEG, PNG, or WebP image.`;
    if (file.size > MAX_IMAGE_SIZE) return `${file.name}: images must be 5 MB or smaller.`;
    if (!file.size) return `${file.name}: the image is empty.`;
  }
  return "";
}

export function label(value) {
  return String(value || "Not available").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function dateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

export function locationText(location) {
  return location ? [location.communityName, location.towerName, location.floorLabel, location.apartmentNumber].filter(Boolean).join(" / ") : "Not available";
}
