import api from "../../../api/client.js";

const dataOf = (response) => response?.data;
const listOf = (response) => dataOf(response) || [];

export const communityAdminService = {
  async getDashboard() { return dataOf(await api.get("/dashboard/summary")); },
  async getReport() { return dataOf(await api.get("/reports/overview")); },
  async getSubscription() { return dataOf(await api.get("/subscriptions/me")); },
  async completeMockPayment() { return dataOf(await api.post("/subscriptions/me/mock-payment")); },
  async requestUpgrade(payload) { return dataOf(await api.post("/subscriptions/me/upgrade", payload)); },
  async completeMockUpgrade() { return dataOf(await api.post("/subscriptions/me/upgrade/mock-payment")); },

  async listCommunities() { return listOf(await api.get("/communities")); },
  async listTowers() { return listOf(await api.get("/towers")); },
  async createTower(payload) { return dataOf(await api.post("/towers", payload)); },
  async updateTower(id, payload) { return dataOf(await api.patch(`/towers/${id}`, payload)); },
  async deleteTower(id) { return dataOf(await api.delete(`/towers/${id}`)); },
  async listFloors() { return listOf(await api.get("/floors")); },
  async createFloor(payload) { return dataOf(await api.post("/floors", payload)); },
  async updateFloor(id, payload) { return dataOf(await api.patch(`/floors/${id}`, payload)); },
  async deleteFloor(id) { return dataOf(await api.delete(`/floors/${id}`)); },
  async listApartments() { return listOf(await api.get("/apartments")); },
  async createApartment(payload) { return dataOf(await api.post("/apartments", payload)); },
  async updateApartment(id, payload) { return dataOf(await api.patch(`/apartments/${id}`, payload)); },
  async deleteApartment(id) { return dataOf(await api.delete(`/apartments/${id}`)); },

  async listUsers() { return listOf(await api.get("/users")); },
  async getUser(id) { return dataOf(await api.get(`/users/${id}`)); },
  async createUser(payload) { return dataOf(await api.post("/users", payload)); },
  async updateUser(id, payload) { return dataOf(await api.patch(`/users/${id}`, payload)); },
  async deleteUser(id) { return dataOf(await api.delete(`/users/${id}`)); },
  async associateResident(id, apartmentId) { return dataOf(await api.patch(`/users/${id}/resident-apartment`, { apartmentId })); },
  async associateRepresentative(id, towerId) { return dataOf(await api.patch(`/users/${id}/representative-tower`, { towerId })); },

  async listWorkers() { return listOf(await api.get("/workforce/workers")); },
  async createWorker(payload) { return dataOf(await api.post("/workforce/workers", payload)); },
  async updateWorker(id, payload) { return dataOf(await api.patch(`/workforce/workers/${id}`, payload)); },
  async deactivateWorker(id) { return dataOf(await api.delete(`/workforce/workers/${id}`)); },

  async listComplaints() { return listOf(await api.get("/complaints")); },
  async getComplaint(id) { return dataOf(await api.get(`/complaints/${id}`)); },
  async updateComplaint(id, payload) { return dataOf(await api.patch(`/complaints/${id}`, payload)); },
  async deleteComplaint(id) { return dataOf(await api.delete(`/complaints/${id}`)); },
  async transitionComplaint(id, status) { return dataOf(await api.patch(`/complaints/${id}/status`, { status })); },
  async listEligibleWorkers(id) { return listOf(await api.get(`/complaints/${id}/eligible-workers`)); },
  async assignWorker(id, workerId) { return dataOf(await api.post(`/complaints/${id}/assign`, { workerId })); },
  async verifyResolution(id, authorityRating) { return dataOf(await api.patch(`/complaints/${id}/verify-resolution`, { authorityRating })); },
  async listComplaintAttachments(id) { return listOf(await api.get(`/complaints/${id}/attachments`)); },
};
