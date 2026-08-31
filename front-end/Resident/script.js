const RESIDENT_PAGE_KEY = "urbanity.resident.lastPage";
const WORK_TYPES = ["PLUMBING", "ELECTRICAL", "CARPENTRY", "HVAC", "LIFT_MAINTENANCE", "CLEANING", "GENERAL_MAINTENANCE"];
const STATUS_LABELS = { SUBMITTED: "Submitted", UNDER_REVIEW: "Under Review", ASSIGNED: "Assigned", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", REVIEWED: "Reviewed", CLOSED: "Closed" };
const state = { page: "dashboard", hierarchy: null, complaints: [], activeComplaint: null };

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const friendly = (value) => String(value || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const api = (path, options) => window.UrbanityApi.apiRequest(path, options);

function notify(message, type = "info") {
  if (window.UIFeedback?.toast) return window.UIFeedback.toast({ scope: "resident", message, type });
  window.alert(message);
}

function currentUser() { return window.UrbanityApi.getStoredUser(); }
function locationText() {
  const { apartment, floor, tower, community } = state.hierarchy || {};
  return [apartment?.label || apartment?.apartmentNumber, floor?.label, tower?.name, community?.name].filter(Boolean).join(" · ") || "Hierarchy unavailable";
}
function setHeader() {
  const user = state.hierarchy?.user || currentUser() || {};
  const name = user.name || user.email || "Resident";
  document.querySelector(".profile-btn-name").textContent = name;
  document.querySelector(".profile-btn-email").textContent = user.email || "";
  document.querySelector(".profile-avatar").textContent = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

async function loadResidentData() {
  const [hierarchyResponse, complaintsResponse] = await Promise.all([api("/users/me/hierarchy"), api("/complaints")]);
  state.hierarchy = hierarchyResponse.data;
  state.complaints = complaintsResponse.data || [];
  setHeader();
}

function statusPill(status) { return `<span class="status-badge status-${String(status || "").toLowerCase()}">${escapeHtml(STATUS_LABELS[status] || friendly(status))}</span>`; }
function complaintRow(complaint) {
  return `<tr><td><button class="link-button complaint-open" data-id="${complaint.id}">${escapeHtml(complaint.title)}</button><div class="table-subtext">${escapeHtml(friendly(complaint.type))} · ${escapeHtml(complaint.requiredWorkType ? friendly(complaint.requiredWorkType) : "")}</div></td><td>${statusPill(complaint.status)}</td><td>${escapeHtml(complaint.responsibleUserName || friendly(complaint.responsibleRole))}</td><td>${escapeHtml(formatDate(complaint.updatedAt || complaint.createdAt))}</td></tr>`;
}

function renderDashboard() {
  const total = state.complaints.length;
  const count = (statuses) => state.complaints.filter((item) => statuses.includes(item.status)).length;
  return `<div class="page-header"><div><h1>Resident Dashboard</h1><p>Track maintenance requests for your apartment and community.</p></div><button class="raise-issue-btn" data-go="raise-issue">Raise Complaint</button></div>
  <div class="stats-grid"><div class="stat-card"><div class="stat-label">My Complaints</div><div class="stat-value">${total}</div></div><div class="stat-card"><div class="stat-label">Submitted</div><div class="stat-value">${count(["SUBMITTED", "UNDER_REVIEW", "ASSIGNED"])}</div></div><div class="stat-card"><div class="stat-label">In Progress</div><div class="stat-value">${count(["IN_PROGRESS"])}</div></div><div class="stat-card"><div class="stat-label">Resolved</div><div class="stat-value">${count(["RESOLVED", "REVIEWED", "CLOSED"])}</div></div></div>
  <section class="content-card"><h2>My Apartment</h2><p><strong>${escapeHtml(locationText())}</strong></p><p>${escapeHtml(state.hierarchy?.community?.address || "")}</p></section>
  <section class="content-card"><div class="section-header"><h2>Recent Complaints</h2><button class="link-button" data-go="my-complaints">View all</button></div>${renderComplaintTable(state.complaints.slice(0, 5))}</section>`;
}

function renderComplaintTable(complaints) {
  if (!complaints.length) return `<div class="empty-state"><p>No complaints yet.</p><button class="raise-issue-btn" data-go="raise-issue">Raise your first complaint</button></div>`;
  return `<div class="table-container"><table><thead><tr><th>Complaint</th><th>Status</th><th>Responsible Authority</th><th>Updated</th></tr></thead><tbody>${complaints.map(complaintRow).join("")}</tbody></table></div>`;
}

function options(values) { return values.map((value) => `<option value="${value}">${escapeHtml(friendly(value))}</option>`).join(""); }
function renderRaiseComplaint() {
  return `<div class="page-header"><div><h1>Raise Complaint</h1><p>Your location is securely derived from your resident profile.</p></div></div><section class="content-card"><div class="location-summary"><strong>Location:</strong> ${escapeHtml(locationText())}</div><form id="complaintForm" class="issue-form"><div class="form-group"><label>Complaint Type</label><select id="complaintType" required><option value="">Select type</option><option value="APARTMENT">Apartment Complaint</option><option value="TOWER">Tower Complaint</option><option value="COMMUNITY">Community Complaint</option></select></div><div class="form-group"><label>Required Work Type</label><select id="workType" required><option value="">Select work type</option>${options(WORK_TYPES)}</select></div><div class="form-group"><label>Title</label><input id="complaintTitle" maxlength="200" required></div><div class="form-group"><label>Description</label><textarea id="complaintDescription" maxlength="2000" required></textarea></div><button class="raise-issue-btn" type="submit">Submit Complaint</button></form></section>`;
}

function renderComplaints() { return `<div class="page-header"><div><h1>My Complaints</h1><p>Only complaints associated with your authenticated resident account are shown.</p></div><button class="raise-issue-btn" data-go="raise-issue">Raise Complaint</button></div><section class="content-card">${renderComplaintTable(state.complaints)}</section>`; }

function renderReviews() {
  const resolved = state.complaints.filter((item) => item.status === "RESOLVED" || item.status === "REVIEWED");
  return `<div class="page-header"><div><h1>Reviews</h1><p>Rate completed maintenance work on resolved complaints.</p></div></div><section class="content-card">${resolved.length ? renderComplaintTable(resolved) : `<div class="empty-state"><p>No resolved complaints are ready for review.</p></div>`}</section>`;
}

function renderProfile() {
  const { user, apartment, floor, tower, community } = state.hierarchy || {};
  return `<div class="page-header"><div><h1>Resident Profile</h1><p>Your profile and apartment association are managed by the Community Admin.</p></div></div><section class="content-card"><div class="profile-info"><div><strong>Name</strong><span>${escapeHtml(user?.name || "—")}</span></div><div><strong>Email</strong><span>${escapeHtml(user?.email || "—")}</span></div><div><strong>Apartment</strong><span>${escapeHtml(apartment?.label || apartment?.apartmentNumber || "—")}</span></div><div><strong>Floor</strong><span>${escapeHtml(floor?.label || "—")}</span></div><div><strong>Tower</strong><span>${escapeHtml(tower?.name || "—")}</span></div><div><strong>Community</strong><span>${escapeHtml(community?.name || "—")}</span></div></div></section>`;
}

function renderPage(page = state.page) {
  state.page = page;
  sessionStorage.setItem(RESIDENT_PAGE_KEY, page);
  const pages = { dashboard: renderDashboard, "raise-issue": renderRaiseComplaint, "my-complaints": renderComplaints, feedback: renderReviews, profile: renderProfile };
  document.getElementById("pageContent").innerHTML = (pages[page] || renderDashboard)();
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === page));
  bindPageEvents();
}

async function submitComplaint(event) {
  event.preventDefault();
  const type = document.getElementById("complaintType").value;
  const requiredWorkType = document.getElementById("workType").value;
  const title = document.getElementById("complaintTitle").value.trim();
  const description = document.getElementById("complaintDescription").value.trim();
  if (!type || !requiredWorkType || !title || !description) return notify("Please complete all complaint fields.", "error");
  try {
    const response = await api("/complaints", { method: "POST", body: { type, title, description, requiredWorkType } });
    await loadResidentData();
    notify("Complaint submitted successfully.", "success");
    renderPage("my-complaints");
    openComplaint(response.data.id);
  } catch (error) { notify(error.message || "Unable to submit complaint.", "error"); }
}

async function openComplaint(id) {
  try {
    const [complaintResponse, attachmentsResponse] = await Promise.all([api(`/complaints/${id}`), api(`/complaints/${id}/attachments`)]);
    state.activeComplaint = complaintResponse.data;
    state.activeComplaint.attachments = attachmentsResponse.data || [];
    let review = null;
    try { review = (await api(`/complaints/${id}/review`, { redirectOnUnauthorized: false })).data; } catch (error) { if (error.status !== 404) throw error; }
    state.activeComplaint.review = review;
    showComplaintModal(state.activeComplaint);
  } catch (error) { notify(error.message || "Unable to load complaint details.", "error"); }
}

function showComplaintModal(complaint) {
  document.getElementById("modalIssueTitle").textContent = complaint.title;
  document.getElementById("modalStatusBadge").textContent = STATUS_LABELS[complaint.status] || friendly(complaint.status);
  document.getElementById("modalCategoryText").textContent = friendly(complaint.type);
  const reviewSection = complaint.review ? `<section class="modal-description-section"><h3>Your Review</h3><p>${"★".repeat(complaint.review.rating)}${"☆".repeat(5 - complaint.review.rating)} · ${escapeHtml(complaint.review.feedback || "No feedback provided")}</p><p>${escapeHtml(formatDate(complaint.review.createdAt))}</p></section>` : complaint.status === "RESOLVED" ? `<section class="modal-description-section"><h3>Review completed work</h3><form id="reviewForm"><label>Rating</label><select id="reviewRating" required><option value="">Select 1–5</option>${[1,2,3,4,5].map((rating) => `<option value="${rating}">${rating} star${rating > 1 ? "s" : ""}</option>`).join("")}</select><label>Feedback (optional)</label><textarea id="reviewFeedback" maxlength="2000"></textarea><button class="raise-issue-btn" type="submit">Submit Review</button></form></section>` : "";
  document.getElementById("modalBodyContent").innerHTML = `<div class="modal-details"><div class="modal-detail-row"><div><div class="modal-detail-label">Location</div><div class="modal-detail-value">${escapeHtml(locationText())}</div></div></div><div class="modal-detail-row"><div><div class="modal-detail-label">Required Work</div><div class="modal-detail-value">${escapeHtml(friendly(complaint.requiredWorkType))}</div></div></div><div class="modal-detail-row"><div><div class="modal-detail-label">Responsible Authority</div><div class="modal-detail-value">${escapeHtml(complaint.responsibleUserName || friendly(complaint.responsibleRole))}</div></div></div><div class="modal-description-section"><div class="modal-detail-label">Description</div><div class="modal-description-text">${escapeHtml(complaint.description)}</div></div><section class="modal-description-section"><h3>Status History</h3>${(complaint.statusHistory || []).map((entry) => `<p>${escapeHtml(STATUS_LABELS[entry.status] || friendly(entry.status))} · ${escapeHtml(formatDate(entry.changedAt))} · ${escapeHtml(friendly(entry.changedByRole))}</p>`).join("")}</section><section class="modal-description-section"><h3>Attachments</h3><form id="attachmentForm"><input id="attachmentFile" type="file" accept="image/jpeg,image/png,image/webp"><button class="link-button" type="submit">Upload image</button></form><div id="attachmentList">${complaint.attachments.length ? complaint.attachments.map((attachment) => `<div class="attachment-item" data-attachment="${attachment.id}">${escapeHtml(attachment.originalName)} (${Math.ceil(attachment.size / 1024)} KB) <span class="attachment-preview"></span></div>`).join("") : "No attachments."}</div></section>${reviewSection}</div>`;
  document.getElementById("issueModal").classList.add("active");
  document.getElementById("attachmentForm")?.addEventListener("submit", uploadAttachment);
  document.getElementById("reviewForm")?.addEventListener("submit", submitReview);
  loadAttachmentPreviews(complaint.id, complaint.attachments);
}

async function loadAttachmentPreviews(complaintId, attachments) {
  for (const attachment of attachments) {
    try {
      const blob = await api(`/complaints/${complaintId}/attachments/${attachment.id}`, { responseType: "blob" });
      const image = document.createElement("img"); image.src = URL.createObjectURL(blob); image.alt = attachment.originalName; image.style.cssText = "width:80px;height:60px;object-fit:cover;margin-left:8px;vertical-align:middle;";
      document.querySelector(`[data-attachment="${attachment.id}"] .attachment-preview`)?.append(image);
    } catch (_error) { /* Individual previews are optional; metadata remains visible. */ }
  }
}

async function uploadAttachment(event) {
  event.preventDefault();
  const file = document.getElementById("attachmentFile").files[0];
  if (!file) return notify("Select an image to upload.", "error");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) return notify("Choose a JPEG, PNG, or WebP image no larger than 5 MB.", "error");
  const formData = new FormData(); formData.append("file", file);
  try { await api(`/complaints/${state.activeComplaint.id}/attachments`, { method: "POST", body: formData }); notify("Image uploaded.", "success"); openComplaint(state.activeComplaint.id); } catch (error) { notify(error.message || "Unable to upload image.", "error"); }
}

async function submitReview(event) {
  event.preventDefault();
  const rating = Number(document.getElementById("reviewRating").value);
  const feedback = document.getElementById("reviewFeedback").value.trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return notify("Select a rating from 1 to 5.", "error");
  try { await api(`/complaints/${state.activeComplaint.id}/review`, { method: "POST", body: feedback ? { rating, feedback } : { rating } }); await loadResidentData(); notify("Review submitted.", "success"); openComplaint(state.activeComplaint.id); } catch (error) { notify(error.message || "Unable to submit review.", "error"); }
}

function closeIssueModal() { document.getElementById("issueModal").classList.remove("active"); }
function bindPageEvents() {
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => renderPage(button.dataset.go)));
  document.querySelectorAll(".complaint-open").forEach((button) => button.addEventListener("click", () => openComplaint(button.dataset.id)));
  document.getElementById("complaintForm")?.addEventListener("submit", submitComplaint);
}

function bindShell() {
  document.querySelectorAll(".nav-item, .profile-menu-item[data-page]").forEach((item) => item.addEventListener("click", (event) => { event.preventDefault(); renderPage(item.dataset.page); }));
  document.querySelectorAll(".sign-out-btn, .profile-signout-btn").forEach((button) => button.addEventListener("click", () => { sessionStorage.removeItem(RESIDENT_PAGE_KEY); window.UrbanityApi.logout(); }));
  document.getElementById("issueModal").addEventListener("click", (event) => { if (event.target.id === "issueModal") closeIssueModal(); });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.UrbanityApi?.getAccessToken()) return window.UrbanityApi?.logout();
  bindShell();
  try {
    await loadResidentData();
    const saved = sessionStorage.getItem(RESIDENT_PAGE_KEY);
    renderPage(["dashboard", "raise-issue", "my-complaints", "feedback", "profile"].includes(saved) ? saved : "dashboard");
  } catch (error) { notify(error.message || "Unable to load the Resident portal.", "error"); }
});
