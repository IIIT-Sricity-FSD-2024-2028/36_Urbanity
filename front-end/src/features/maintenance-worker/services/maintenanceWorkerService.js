import { api } from "../../../api/client.js";

const complaintPath = (id) => `/complaints/${encodeURIComponent(id)}`;

export const maintenanceWorkerService = {
  async getProfile(signal) {
    return (await api.get("/workforce/workers/me", { signal })).data;
  },
  async getTasks(signal) {
    const response = await api.get("/complaints", { signal });
    if (!Array.isArray(response.data)) throw new Error("Unable to read assigned tasks.");
    return response.data;
  },
  async getTask(id, signal) {
    return (await api.get(complaintPath(id), { signal })).data;
  },
  async getAttachments(id, signal) {
    const response = await api.get(`${complaintPath(id)}/attachments`, { signal });
    if (!Array.isArray(response.data)) throw new Error("Unable to read attachments.");
    return response.data;
  },
  startWork(id) {
    return api.patch(`${complaintPath(id)}/start`, {});
  },
  resolveWork(id, { problemFound, resolutionSummary, proofAttachmentIds }) {
    return api.patch(`${complaintPath(id)}/resolve`, {
      problemFound: problemFound.trim(),
      resolutionSummary: resolutionSummary.trim(),
      proofAttachmentIds,
    });
  },
  async uploadProof(id, file) {
    const body = new FormData();
    body.append("file", file);
    return (await api.post(`${complaintPath(id)}/attachments`, body)).data;
  },
  getAttachmentBlob(id, attachmentId, signal) {
    return api.get(`${complaintPath(id)}/attachments/${encodeURIComponent(attachmentId)}`, {
      responseType: "blob", signal,
    });
  },
};
