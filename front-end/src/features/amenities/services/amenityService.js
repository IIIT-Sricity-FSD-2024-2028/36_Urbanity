import { api } from "../../../api/client.js";
const data = (response) => response.data;
export const amenityService = {
  list: (signal) => api.get("/amenities", { signal }).then(data),
  bookings: (signal) => api.get("/amenity-bookings", { signal }).then(data),
  save: (id, values) =>
    (id
      ? api.patch(`/amenities/${id}`, values)
      : api.post("/amenities", values)
    ).then(data),
  availability: (id, values) =>
    api.post(`/amenities/${id}/availability`, values).then(data),
  day: (id, values, signal) =>
    api
      .post(`/amenities/${id}/availability/day`, values, { signal })
      .then(data),
  changeOptions: (id, values, signal) =>
    api
      .post(`/amenity-bookings/${id}/change-availability`, values, { signal })
      .then(data),
  change: (id, values) =>
    api.post(`/amenity-bookings/${id}/changes`, values).then(data),
  decideChange: (id, changeId, action, reason) =>
    api
      .patch(`/amenity-bookings/${id}/changes/${changeId}/${action}`, {
        reason,
      })
      .then(data),
  book: (id, values) =>
    api.post(`/amenities/${id}/bookings`, values).then(data),
  transition: (id, action, reason) =>
    api.patch(`/amenity-bookings/${id}/${action}`, { reason }).then(data),
  blocks: (id, signal) =>
    api.get(`/amenities/${id}/blocks`, { signal }).then(data),
  block: (id, values) => api.post(`/amenities/${id}/blocks`, values).then(data),
  release: (id, blockId) =>
    api.patch(`/amenities/${id}/blocks/${blockId}/release`).then(data),
};
export const money = (minor) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    minor / 100,
  );
export const dateTime = (value) => new Date(value).toLocaleString();
export const windowPayload = (values) => ({
  startsAt: new Date(values.startsAt).toISOString(),
  endsAt: new Date(values.endsAt).toISOString(),
  attendees: Number(values.attendees),
});
