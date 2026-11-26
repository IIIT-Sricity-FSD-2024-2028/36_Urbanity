import { api } from "../../../api/client.js";

const complaintPath = (id) => `/complaints/${encodeURIComponent(id)}`;
const revisionPath = (id, estimateId) => `${complaintPath(id)}/estimates/${encodeURIComponent(estimateId)}`;

export const estimateService = {
  async get(id, signal) {
    return (await api.get(`${complaintPath(id)}/estimate`, { signal })).data;
  },
  async list(signal) {
    return (await api.get("/complaints/estimates/queue", { signal })).data;
  },
  async submit(id, payload, signal) {
    return (await api.post(`${complaintPath(id)}/estimate`, payload, { signal })).data;
  },
  async towerDecision(id, estimateId, payload, signal) {
    return (await api.patch(`${revisionPath(id, estimateId)}/tower-decision`, payload, { signal })).data;
  },
  async adminDecision(id, estimateId, payload, signal) {
    return (await api.patch(`${revisionPath(id, estimateId)}/admin-decision`, payload, { signal })).data;
  },
  async pay(id, estimateId, signal) {
    return (await api.post(`${revisionPath(id, estimateId)}/mock-payment`, { confirmed: true }, { signal })).data;
  },
  async cancel(id, estimateId, { reason }, signal) {
    return (await api.patch(`${revisionPath(id, estimateId)}/cancel`, { reason }, { signal })).data;
  },
};
