export const formatEnum = (value) => String(value || "Unknown").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
export const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Unavailable";
export const entityName = (items = [], id) => items.find((item) => item.id === id)?.name || items.find((item) => item.id === id)?.label || items.find((item) => item.id === id)?.apartmentNumber || "Unavailable";
