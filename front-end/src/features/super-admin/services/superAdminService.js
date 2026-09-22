import api from "../../../api/client.js";

const dataOf = (response) => response?.data;

export const superAdminService = {
  async getDashboard() { return dataOf(await api.get("/dashboard/summary")); },
  async getReport() { return dataOf(await api.get("/reports/overview")); },

  async listCommunities() { return dataOf(await api.get("/communities")) || []; },
  async listSubscriptions() { return dataOf(await api.get("/subscriptions")) || []; },
  async createCommunity(payload) { return dataOf(await api.post("/communities", payload)); },
  async updateCommunity(id, payload) { return dataOf(await api.patch(`/communities/${id}`, payload)); },
  async deleteCommunity(id) { return dataOf(await api.delete(`/communities/${id}`)); },

  async listUsers() { return dataOf(await api.get("/users")) || []; },
  async getUser(id) { return dataOf(await api.get(`/users/${id}`)); },
  async createUser(payload) { return dataOf(await api.post("/users", payload)); },
  async updateUser(id, payload) { return dataOf(await api.patch(`/users/${id}`, payload)); },
  async deleteUser(id) { return dataOf(await api.delete(`/users/${id}`)); },

  async listTowers() { return dataOf(await api.get("/towers")) || []; },
  async listFloors() { return dataOf(await api.get("/floors")) || []; },
  async listApartments() { return dataOf(await api.get("/apartments")) || []; },

  async listWorkers() { return dataOf(await api.get("/workforce/workers")) || []; },
  async createWorker(payload) { return dataOf(await api.post("/workforce/workers", payload)); },
  async updateWorker(id, payload) { return dataOf(await api.patch(`/workforce/workers/${id}`, payload)); },
  async deactivateWorker(id) { return dataOf(await api.delete(`/workforce/workers/${id}`)); },

  async listComplaints() { return dataOf(await api.get("/complaints")) || []; },
  async getComplaint(id) { return dataOf(await api.get(`/complaints/${id}`)); },
  async getComplaintAttachments(id) { return dataOf(await api.get(`/complaints/${id}/attachments`)) || []; },
  async getComplaintReview(id) { return dataOf(await api.get(`/complaints/${id}/review`)); },
  async downloadComplaintAttachment(complaintId, attachmentId) {
    return api.get(`/complaints/${complaintId}/attachments/${attachmentId}`, { responseType: "blob" });
  },
};
