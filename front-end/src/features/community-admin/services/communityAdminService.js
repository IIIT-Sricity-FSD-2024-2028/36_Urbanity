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

  async listCommunities(signal) { return listOf(await api.get("/communities", { signal })); },
  async listTowers(signal) { return listOf(await api.get("/towers", { signal })); },
  async createTower(payload, signal) { return dataOf(await api.post("/towers", payload, { signal })); },
  async updateTower(id, payload, signal) { return dataOf(await api.patch(`/towers/${id}`, payload, { signal })); },
  async deleteTower(id, signal) { return dataOf(await api.delete(`/towers/${id}`, { signal })); },
  async listFloors(signal) { return listOf(await api.get("/floors", { signal })); },
  async createFloor(payload, signal) { return dataOf(await api.post("/floors", payload, { signal })); },
  async updateFloor(id, payload, signal) { return dataOf(await api.patch(`/floors/${id}`, payload, { signal })); },
  async deleteFloor(id, signal) { return dataOf(await api.delete(`/floors/${id}`, { signal })); },
  async listApartments(signal) { return listOf(await api.get("/apartments", { signal })); },
  async createApartment(payload, signal) { return dataOf(await api.post("/apartments", payload, { signal })); },
  async updateApartment(id, payload, signal) { return dataOf(await api.patch(`/apartments/${id}`, payload, { signal })); },
  async transferApartmentOwnership(id, payload, signal) { return dataOf(await api.post(`/apartments/${id}/ownership-transfer`, payload, { signal })); },
  async getApartmentOwnershipHistory(id, signal) { return listOf(await api.get(`/apartments/${id}/ownership-history`, { signal })); },
  async deleteApartment(id, signal) { return dataOf(await api.delete(`/apartments/${id}`, { signal })); },

  async listUsers(signal) { return listOf(await api.get("/users", { signal })); },
  async getUser(id) { return dataOf(await api.get(`/users/${id}`)); },
  async createUser(payload) { return dataOf(await api.post("/users", payload)); },
  async updateUser(id, payload, signal) { return dataOf(await api.patch(`/users/${id}`, payload, { signal })); },
  async deleteUser(id, signal) { return dataOf(await api.delete(`/users/${id}`, { signal })); },
  async associateResident(id, apartmentId, signal) { return dataOf(await api.patch(`/users/${id}/resident-apartment`, { apartmentId }, { signal })); },
  async associateRepresentative(id, towerId, signal) { return dataOf(await api.patch(`/users/${id}/representative-tower`, { towerId }, { signal })); },

  async listWorkers(signal) { return listOf(await api.get("/workforce/workers", { signal })); },
  async createWorker(payload, signal) { return dataOf(await api.post("/workforce/workers", payload, { signal })); },
  async updateWorker(id, payload, signal) { return dataOf(await api.patch(`/workforce/workers/${id}`, payload, { signal })); },
  async deactivateWorker(id, signal) { return dataOf(await api.delete(`/workforce/workers/${id}`, { signal })); },

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
