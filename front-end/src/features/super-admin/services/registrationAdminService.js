import api from "../../../api/client.js";
const base = "/registration-administration";
export const registrationAdminService = {
  list: async (signal) => (await api.get(base, { signal })).data,
  pricing: async (signal) =>
    (await api.get(`${base}/pricing`, { signal })).data,
  configure: async (body) => (await api.patch(`${base}/pricing`, body)).data,
  acceptAndNotify: async (id, body) =>
    (await api.post(`${base}/${id}/accept-and-notify`, body)).data,
  review: async (id, body) =>
    (await api.post(`${base}/${id}/review`, body)).data,
  reviewPayment: async (id, paymentId, body) =>
    (await api.post(`${base}/${id}/payments/${paymentId}/review`, body)).data,
  activate: async (id) => (await api.post(`${base}/${id}/activate`, {})).data,
};
