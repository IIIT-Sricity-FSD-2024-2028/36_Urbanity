import api from "../../../api/client.js";

const dataOf = (response) => response?.data;

// Every call below maps to a backend route that authorizes TOWER_REPRESENTATIVE.
// Scope (own tower / own community) is derived by the backend from the JWT.
export const towerRepresentativeService = {
  async getOwnHierarchy() { return dataOf(await api.get("/users/me/hierarchy")); },
  async getResidentHierarchy(userId) { return dataOf(await api.get(`/users/${userId}/resident-hierarchy`)); },

  async listComplaints() { return dataOf(await api.get("/complaints")) || []; },
  async getComplaint(id) { return dataOf(await api.get(`/complaints/${id}`)); },
  async getComplaintReview(id) { return dataOf(await api.get(`/complaints/${id}/review`)); },
  async listComplaintAttachments(id) { return dataOf(await api.get(`/complaints/${id}/attachments`)) || []; },
  async downloadComplaintAttachment(complaintId, attachmentId) {
    return api.get(`/complaints/${complaintId}/attachments/${attachmentId}`, { responseType: "blob" });
  },

  async startReview(id) { return dataOf(await api.patch(`/complaints/${id}/status`, { status: "UNDER_REVIEW" })); },
  async closeComplaint(id) { return dataOf(await api.patch(`/complaints/${id}/status`, { status: "CLOSED" })); },
  async listEligibleWorkers(id) { return dataOf(await api.get(`/complaints/${id}/eligible-workers`)) || []; },
  async assignWorker(id, workerId) { return dataOf(await api.post(`/complaints/${id}/assign`, { workerId })); },
  async verifyResolution(id, authorityRating) {
    return dataOf(await api.patch(`/complaints/${id}/verify-resolution`, { authorityRating }));
  },

  async listWorkers() { return dataOf(await api.get("/workforce/workers")) || []; },
  async getWorker(id) { return dataOf(await api.get(`/workforce/workers/${id}`)); },

  // Appointments: the backend scopes listings to the representative's tower and
  // allows mutations only by the complaint's responsible representative.
  async listAppointments() { return dataOf(await api.get("/appointments")) || []; },
  async getAppointment(id) { return dataOf(await api.get(`/appointments/${id}`)); },
  async listTimeSlots() { return dataOf(await api.get("/appointments/time-slots")) || []; },
  async getWorkerSchedule(workerId, date) {
    return dataOf(await api.get(`/appointments/workers/${workerId}/schedule`, { params: date ? { date } : {} }));
  },
  async confirmAppointment(id, { workerId, scheduledDate, timeSlot }) {
    return dataOf(await api.patch(`/appointments/${id}/confirm`, { workerId, scheduledDate, timeSlot }));
  },
  async decideReschedule(id, { decision, scheduledDate, timeSlot, note }) {
    return dataOf(await api.patch(`/appointments/${id}/reschedule-decision`, {
      decision,
      ...(decision === "APPROVE" ? { scheduledDate, timeSlot } : {}),
      ...(note ? { note } : {}),
    }));
  },
  async cancelAppointment(id, reason) { return dataOf(await api.patch(`/appointments/${id}/cancel`, { reason })); },
  async markAppointmentMissed(id, reason) { return dataOf(await api.patch(`/appointments/${id}/missed`, { reason })); },
};
