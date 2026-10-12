import api from "../../../api/client.js";

const complaintPath = (id) => `/complaints/${encodeURIComponent(id)}`;

export const residentService = {
  async getHierarchy() {
    return (await api.get("/users/me/hierarchy")).data;
  },
  async listComplaints() {
    return (await api.get("/complaints")).data;
  },
  async getComplaint(id) {
    return (await api.get(complaintPath(id))).data;
  },
  async createComplaint({ type, title, description, requiredWorkType }) {
    // Identity, location and responsibility are derived by the backend.
    return (await api.post("/complaints", { type, title, description, requiredWorkType })).data;
  },
  async getReview(id) {
    try {
      return (await api.get(`${complaintPath(id)}/review`)).data;
    } catch (error) {
      // The service uses this specific 400 response for an absent review.
      if (error.status === 400 && error.message === "Complaint review was not found") return null;
      throw error;
    }
  },
  async submitReview(id, { speedRating, qualityRating, communicationRating, feedback }) {
    return (await api.post(`${complaintPath(id)}/review`, {
      speedRating, qualityRating, communicationRating,
      ...(feedback ? { feedback } : {}),
    })).data;
  },
  async listAttachments(id) {
    return (await api.get(`${complaintPath(id)}/attachments`)).data;
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
