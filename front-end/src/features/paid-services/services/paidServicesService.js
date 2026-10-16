import { api } from "../../../api/client.js";

const root = "/paid-services";
const requestPath = (id) => `${root}/requests/${encodeURIComponent(id)}`;
export const paidServicesService = {
  async catalogue(signal) { return (await api.get(`${root}/catalogue`, { signal })).data; },
  async saveCatalogue(id, payload) { return (await (id ? api.patch(`${root}/catalogue/${encodeURIComponent(id)}`, payload) : api.post(`${root}/catalogue`, payload))).data; },
  async requests(signal) { return (await api.get(`${root}/requests`, { signal })).data; },
  async request(id, signal) { return (await api.get(requestPath(id), { signal })).data; },
  async create(payload) { return (await api.post(`${root}/requests`, payload)).data; },
  async workers(id, signal) { return (await api.get(`${requestPath(id)}/eligible-workers`, { signal })).data; },
  async action(id, action, payload) { return (await api.post(`${requestPath(id)}/${action}`, payload)).data; },
  async uploadEvidence(id, file) {
    const data = new FormData(); data.append("file", file);
    return (await api.post(`${requestPath(id)}/evidence`, data)).data;
  },
  evidence(id, evidenceId) { return api.get(`${requestPath(id)}/evidence/${encodeURIComponent(evidenceId)}`, { responseType: "blob" }); },
};
