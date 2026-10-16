import api from "../../../api/client.js";

const complaintPath = (id) => `/complaints/${encodeURIComponent(id)}`;

export const residentService = {
  async getRentals() {
    const [mine, apartments, listings, leases] = await Promise.all([api.get("/rentals/me"), api.get("/rentals/owned-apartments"), api.get("/rentals/managed/listings"), api.get("/rentals/managed/leases")]);
    return { ...mine.data, ownedApartments: apartments.data, managedListings: listings.data, managedLeases: leases.data };
  },
  async getRentalTenants(listingId) { return (await api.get(`/rentals/managed/listings/${encodeURIComponent(listingId)}/tenants`)).data; },
  async createRentalListing(payload) { return (await api.post("/rentals/listings", payload)).data; },
  async updateRentalListing(id, payload) { return (await api.patch(`/rentals/listings/${encodeURIComponent(id)}`, payload)).data; },
  async createRentalLease(payload) { return (await api.post("/rentals/leases", payload)).data; },
  async acceptRentalLease(id) { return (await api.post(`/rentals/me/leases/${encodeURIComponent(id)}/accept`)).data; },
  async activateRentalLease(id) { return (await api.post(`/rentals/managed/leases/${encodeURIComponent(id)}/activate`)).data; },
  async reviewRentalPayment(id, decision) { return (await api.post(`/rentals/payments/${encodeURIComponent(id)}/review`, { decision })).data; },
  async recordRentalRefund(id, payload) { return (await api.post(`/rentals/payments/${encodeURIComponent(id)}/refunds`, payload)).data; },
  async reviewRentalRefund(id, decision) { return (await api.post(`/rentals/refunds/${encodeURIComponent(id)}/review`, { decision })).data; },
  async decideRentalRequest(id, decision) { return (await api.post(`/rentals/requests/${encodeURIComponent(id)}/decision`, { decision })).data; },
  async withdrawRentalRequest(id) { return (await api.post(`/rentals/requests/${encodeURIComponent(id)}/withdraw`)).data; },
  async proposeRentAmendment(leaseId, payload) { return (await api.post(`/rentals/leases/${encodeURIComponent(leaseId)}/amendments`, payload)).data; },
  async decideRentAmendment(id, decision) { return (await api.post(`/rentals/amendments/${encodeURIComponent(id)}/decision`, { decision })).data; },
  async withdrawRentAmendment(id) { return (await api.post(`/rentals/amendments/${encodeURIComponent(id)}/withdraw`)).data; },
  async submitDepositEvidence(leaseId, payload) { return (await api.post(`/rentals/me/leases/${encodeURIComponent(leaseId)}/deposit/evidence`, payload)).data; },
  async reviewDeposit(id, decision) { return (await api.post(`/rentals/deposits/${encodeURIComponent(id)}/review`, { decision })).data; },
  async decideDepositDeduction(id, decision, reason) { return (await api.post(`/rentals/deposits/${encodeURIComponent(id)}/decision`, { decision, ...(reason ? { reason } : {}) })).data; },
  async resolveDepositDispute(id, decision, reason) { return (await api.post(`/rentals/deposits/${encodeURIComponent(id)}/dispute-resolution`, { decision, reason })).data; },
  async createDepositDeduction(leaseId, payload) { return (await api.post(`/rentals/leases/${encodeURIComponent(leaseId)}/deposit/deductions`, payload)).data; },
  async createDepositRefund(leaseId, payload) { return (await api.post(`/rentals/leases/${encodeURIComponent(leaseId)}/deposit/refunds`, payload)).data; },
  async submitPaymentEvidence(leaseId, obligationId, payload) { return (await api.post(`/rentals/me/leases/${encodeURIComponent(leaseId)}/obligations/${encodeURIComponent(obligationId)}/payment-evidence`, payload)).data; },
  async requestLeaseChange(leaseId, type, terms) { return (await api.post(`/rentals/me/leases/${encodeURIComponent(leaseId)}/requests/${encodeURIComponent(type)}`, terms)).data; },
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
