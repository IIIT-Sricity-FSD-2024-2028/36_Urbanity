import api from "../../../api/client.js";

const complaintPath = (id) => `/complaints/${encodeURIComponent(id)}`;
const dataOf = (response) => response?.data;

export const residentService = {
  async getHierarchy(signal) {
    return dataOf(await api.get("/users/me/hierarchy", { signal }));
  },
  async listComplaints(signal) {
    return dataOf(await api.get("/complaints", { signal }));
  },
  async getComplaint(id, signal) {
    return dataOf(await api.get(complaintPath(id), { signal }));
  },
  async createComplaint({ type, title, description, requiredWorkType }, signal) {
    // Identity, location and responsibility are derived by the backend.
    return dataOf(await api.post("/complaints", { type, title, description, requiredWorkType }, { signal }));
  },
  async getReview(id, signal) {
    try {
      return dataOf(await api.get(`${complaintPath(id)}/review`, { signal }));
    } catch (error) {
      // The service uses this specific 400 response for an absent review.
      if (error.status === 400 && error.message === "Complaint review was not found") return null;
      throw error;
    }
  },
  async submitReview(id, { speedRating, qualityRating, communicationRating, feedback }, signal) {
    return dataOf(await api.post(`${complaintPath(id)}/review`, {
      speedRating, qualityRating, communicationRating,
      ...(feedback ? { feedback } : {}),
    }, { signal }));
  },
  async listAttachments(id, signal) {
    return dataOf(await api.get(`${complaintPath(id)}/attachments`, { signal }));
  },
  async uploadAttachment(id, file) {
    const body = new FormData();
    body.append("file", file);
    return (await api.post(`${complaintPath(id)}/attachments`, body)).data;
  },
  getAttachment(id, attachmentId) {
    return api.get(`${complaintPath(id)}/attachments/${encodeURIComponent(attachmentId)}`, { responseType: "blob" });
  },
};
