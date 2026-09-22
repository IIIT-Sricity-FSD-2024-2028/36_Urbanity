export function formatEnum(value) {
  return String(value || "Unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

export function entityName(items, id, fallback = "Not assigned") {
  return items.find((item) => item.id === id)?.name || fallback;
}

export function associationLabel(user, data) {
  if (user.communityId) return entityName(data.communities, user.communityId);
  if (user.towerId) return entityName(data.towers, user.towerId);
  if (user.apartmentId) return entityName(data.apartments, user.apartmentId, user.apartmentId);
  return "Platform-wide";
}
