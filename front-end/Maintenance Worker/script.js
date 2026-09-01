const workerState = { page: "dashboard", user: null, profile: null, complaints: [], active: null };
const api = (path, options = {}) => window.UrbanityApi.apiRequest(path, options);
const label = (value) => String(value || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

function notify(message, type = "error") {
  let host = document.querySelector(".urbanity-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "urbanity-toast-host";
    host.setAttribute("aria-live", "polite");
    document.body.append(host);
  }
  const toast = document.createElement("div");
  toast.className = `urbanity-toast urbanity-toast-${type}`;
  toast.textContent = message;
  host.append(toast);
  window.setTimeout(() => toast.remove(), 4500);
}

function accountDisplayName(email) {
  return (email || "Maintenance Worker").split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function updateAccountUI() {
  const user = workerState.user || {};
  const name = accountDisplayName(user.email);
  document.querySelector(".profile-btn-name").textContent = name;
  document.querySelector(".profile-btn-email").textContent = user.email || "Account unavailable";
  document.getElementById("profileAvatar").textContent = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "MW";
}

async function loadWorker() {
  const [user, profileResponse, complaintsResponse] = await Promise.all([
    window.UrbanityApi.getCurrentUser(),
    api("/workforce/workers/me"),
    api("/complaints"),
  ]);
  if (user?.role !== "MAINTENANCE_WORKER") {
    window.UrbanityApi.clearSession();
    window.UrbanityApi.logout();
    return;
  }
  workerState.user = user;
  workerState.profile = profileResponse.data;
  workerState.complaints = complaintsResponse.data || [];
  updateAccountUI();
}

function statusBadge(status) {
  return `<span class="status-badge status-${String(status || "").toLowerCase().replace(/_/g, "-")}">${escapeHtml(label(status))}</span>`;
}

function emptyState(message) {
  return `<div class="empty-state"><span class="empty-state-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 7h6m-6 4h4"/></svg></span><p>${escapeHtml(message)}</p></div>`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function rows(items, emptyMessage = "No maintenance work is available in this view.") {
  if (!items.length) return emptyState(emptyMessage);
  return `<div class="table-container"><table class="tasks-table"><thead><tr><th>Maintenance work</th><th>Status</th><th>Specialization</th><th>Last updated</th></tr></thead><tbody>${items.map((complaint) => `<tr><td><button class="task" type="button" data-id="${escapeHtml(complaint.id)}">${escapeHtml(complaint.title)}</button><span class="task-description">${escapeHtml(complaint.type)} complaint</span></td><td>${statusBadge(complaint.status)}</td><td>${escapeHtml(label(complaint.requiredWorkType))}</td><td class="task-date">${escapeHtml(formatDate(complaint.updatedAt))}</td></tr>`).join("")}</tbody></table></div>`;
}

function metric(value, title, detail, tone, icon) {
  return `<div class="stat-card worker-metric-card"><span class="metric-icon metric-icon-${tone}" aria-hidden="true">${icon || ""}</span><b class="stat-value">${escapeHtml(value)}</b><span class="stat-label">${escapeHtml(title)}</span><span class="metric-detail">${escapeHtml(detail)}</span></div>`;
}

const metricIcons = {
  work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 7h6m-6 4h4"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path stroke-linecap="round" stroke-linejoin="round" d="M4 14l5-5 4 4 7-7"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 6h5v5"/></svg>',
  complete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path stroke-linecap="round" stroke-linejoin="round" d="m5 12 4 4L19 6"/></svg>',
  rating: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path stroke-linecap="round" stroke-linejoin="round" d="m12 3 2.8 5.67 6.26.91-4.53 4.41 1.07 6.24L12 17.3l-5.6 2.93 1.07-6.24L2.94 9.58l6.26-.91L12 3Z"/></svg>',
};

function dashboard() {
  const complaints = workerState.complaints;
  const profile = workerState.profile || {};
  const user = workerState.user || {};
  const activeCount = complaints.filter((complaint) => ["ASSIGNED", "IN_PROGRESS"].includes(complaint.status)).length;
  const name = accountDisplayName(user.email);
  const recentWork = complaints.slice(0, 5);
  return `<section class="worker-hero"><div><p class="worker-hero-eyebrow">Maintenance workspace</p><h1>Welcome back, ${escapeHtml(name)}.</h1><p>Review assigned work, update active repairs, and keep your community running smoothly.</p></div><div class="worker-hero-status"><span>Current work status</span>${statusBadge(profile.status)}</div></section><div class="stats-grid worker-metrics">${metric(activeCount, "Active work", "Assigned or in progress", "blue", metricIcons.work)}${metric(complaints.filter((complaint) => complaint.status === "IN_PROGRESS").length, "In progress", "Work underway", "orange", metricIcons.progress)}${metric(profile.completedWorkCount ?? 0, "Completed", "Backend-managed total", "green", metricIcons.complete)}${metric(`${profile.rating ?? 0} / 5`, "Rating", "Resident review average", "purple", metricIcons.rating)}</div><div class="worker-dashboard-grid"><section class="worker-context-card"><div class="worker-context-heading"><div><p class="section-eyebrow">Your worker profile</p><h2>Service overview</h2></div><span class="worker-context-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0"/></svg></span></div><dl class="worker-context-list"><div><dt>Specialization</dt><dd>${escapeHtml(label(profile.specialization))}</dd></div><div><dt>Work status</dt><dd>${statusBadge(profile.status)}</dd></div><div><dt>Completed work</dt><dd>${escapeHtml(profile.completedWorkCount ?? 0)}</dd></div><div><dt>Average rating</dt><dd>${escapeHtml(profile.rating ?? 0)} / 5</dd></div></dl><button class="dashboard-secondary-button" type="button" data-page-target="profile">View profile</button></section><section class="content-card worker-recent-card"><div class="table-header"><div><p class="section-eyebrow">Latest activity</p><h2 class="table-title">Recent assigned work</h2></div><button class="dashboard-secondary-button" type="button" data-page-target="assigned-tasks">View all</button></div>${rows(recentWork)}</section></div>`;
}

function profile() {
  const profileData = workerState.profile || {};
  const user = workerState.user || {};
  const accountName = accountDisplayName(user.email);
  const initials = accountName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return `<div class="page-header profile-page-header"><div><h1 class="page-title">Maintenance Worker Profile</h1><p class="page-subtitle">Review your authenticated account and service profile details.</p></div></div><section class="worker-hero worker-profile-workspace"><div class="worker-profile-account"><span class="profile-workspace-avatar">${escapeHtml(initials || "MW")}</span><div><p class="worker-hero-eyebrow">Authenticated maintenance worker</p><h1>${escapeHtml(accountName)}</h1><p>${escapeHtml(user.email || "Email unavailable")}</p><span class="worker-profile-role">Maintenance Worker</span></div></div><div class="worker-hero-status"><strong class="worker-verified"><span aria-hidden="true">✓</span> Verified session</strong></div></section><section class="content-card profile-details-card"><div class="table-header"><div><p class="section-eyebrow">Profile details</p><h2 class="table-title">Your Urbanity account</h2></div><span class="profile-managed-pill">Worker profile managed by Community Admin</span></div><dl class="profile-details-grid"><div><dt>Account name</dt><dd>${escapeHtml(accountName)}</dd></div><div><dt>Email address</dt><dd>${escapeHtml(user.email || "Not available")}</dd></div><div><dt>Specialization</dt><dd>${escapeHtml(label(profileData.specialization))}</dd></div><div><dt>Work status</dt><dd>${statusBadge(profileData.status)}</dd></div><div><dt>Rating</dt><dd>${escapeHtml(profileData.rating ?? 0)} / 5</dd></div><div><dt>Completed work</dt><dd>${escapeHtml(profileData.completedWorkCount ?? 0)}</dd></div></dl></section>`;
}

function render(page = workerState.page) {
  workerState.page = page;
  let complaints = workerState.complaints;
  if (page === "in-progress") complaints = complaints.filter((complaint) => complaint.status === "IN_PROGRESS");
  if (page === "completed") complaints = complaints.filter((complaint) => ["PENDING_VERIFICATION", "RESOLVED", "REVIEWED", "CLOSED"].includes(complaint.status));
  const pageTitle = page === "in-progress" ? "In Progress Work" : page === "completed" ? "Completed Work" : "Assigned Maintenance Work";
  const pageDescription = page === "in-progress" ? "Work you have started and can resolve when complete." : page === "completed" ? "Maintenance work resolved by you." : "All maintenance work assigned to your worker profile.";
  document.getElementById("pageContent").innerHTML = page === "dashboard" ? dashboard() : page === "profile" ? profile() : `<section class="content-card"><div class="page-header"><p class="page-eyebrow">Maintenance workspace</p><h1 class="page-title">${pageTitle}</h1><p class="page-subtitle">${pageDescription}</p></div><div class="table-header"><div><p class="section-eyebrow">Assigned work</p><h2 class="table-title">${pageTitle}</h2></div><span class="table-count">${escapeHtml(complaints.length)} total</span></div>${rows(complaints)}</section>`;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === page));
  document.querySelectorAll(".task").forEach((button) => { button.onclick = () => openTask(button.dataset.id); });
  document.querySelectorAll("[data-page-target]").forEach((button) => { button.onclick = () => render(button.dataset.pageTarget); });
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("active");
  workerState.active = null;
}

async function openTask(id) {
  try {
    const [complaintResponse, attachmentsResponse] = await Promise.all([api(`/complaints/${id}`), api(`/complaints/${id}/attachments`)]);
    workerState.active = { ...complaintResponse.data, attachments: attachmentsResponse.data || [] };
    const complaint = workerState.active;
    document.getElementById("modalContent").innerHTML = `<div class="modal-section"><p class="section-eyebrow">Assigned maintenance work</p><h3 class="modal-task-title">${escapeHtml(complaint.title)}</h3><p class="modal-description">${escapeHtml(complaint.description)}</p></div><div class="modal-grid"><div><p class="modal-label">Complaint type</p><p class="modal-value">${escapeHtml(label(complaint.type))}</p></div><div><p class="modal-label">Specialization</p><p class="modal-value">${escapeHtml(label(complaint.requiredWorkType))}</p></div><div><p class="modal-label">Status</p><p class="modal-value">${statusBadge(complaint.status)}</p></div><div><p class="modal-label">Responsible authority</p><p class="modal-value">${escapeHtml(complaint.responsibleUserName || "—")}</p></div></div><div class="modal-section attachment-section"><p class="modal-label">Resident attachments</p>${complaint.attachments.length ? `<ul class="history-list">${complaint.attachments.map((attachment) => `<li>${escapeHtml(attachment.originalName)}</li>`).join("")}</ul>` : '<p class="modal-value">No attachments were provided.</p>'}</div>`;
    const location = complaint.location ? [complaint.location.communityName, complaint.location.towerName, complaint.location.floorLabel, complaint.location.apartmentNumber].filter(Boolean).join(" / ") : "Location unavailable";
    const proofSummary = complaint.resolutionProof ? `<div class="modal-section"><p class="modal-label">Resolution proof</p><p class="modal-value"><b>Problem identified:</b> ${escapeHtml(complaint.resolutionProof.problemFound)}</p><p class="modal-value"><b>Resolution:</b> ${escapeHtml(complaint.resolutionProof.resolutionSummary)}</p>${complaint.resolutionVerification ? `<p class="modal-value"><b>Verified by:</b> ${escapeHtml(complaint.resolutionVerification.verifiedByUserName)} (${escapeHtml(complaint.resolutionVerification.authorityRating)} / 5)</p>` : '<p class="modal-value">Awaiting responsible-authority verification.</p>'}</div>` : "";
    const proofForm = complaint.status === "IN_PROGRESS" ? `<form id="resolutionProofForm" class="modal-section attachment-section completion-form"><p class="section-eyebrow">Submit proof of work</p><label class="completion-form-label" for="problemFound">Problem identified</label><textarea id="problemFound" class="completion-form-textarea" maxlength="2000" placeholder="Describe the issue found" required></textarea><label class="completion-form-label" for="resolutionSummary">How was it resolved?</label><textarea id="resolutionSummary" class="completion-form-textarea" maxlength="2000" placeholder="Explain the completed work" required></textarea><label class="completion-form-label" for="resolutionProofFiles">Proof media</label><input id="resolutionProofFiles" class="completion-form-file" type="file" accept="image/jpeg,image/png,image/webp" multiple required><p class="completion-form-hint">Attach at least one JPEG, PNG, or WebP image (up to 5 MB each).</p><button class="modal-btn modal-btn-blue" type="submit">Submit proof for verification</button></form>` : "";
    document.getElementById("modalContent").insertAdjacentHTML("beforeend", `<div class="modal-section"><p class="modal-label">Complaint location</p><p class="modal-value">${escapeHtml(location)}</p></div>${proofSummary}${proofForm}`);
    const actionButton = document.getElementById("modalActionBtn");
    const canAct = complaint.status === "ASSIGNED";
    actionButton.hidden = !canAct;
    actionButton.closest(".modal-footer").hidden = !canAct;
    actionButton.disabled = false;
    actionButton.textContent = "Start Work";
    actionButton.onclick = () => workerAction(complaint.id);
    document.getElementById("resolutionProofForm")?.addEventListener("submit", submitResolutionProof);
    document.getElementById("modalOverlay").classList.add("active");
  } catch (error) {
    notify(error.message || "Unable to load task details.");
  }
}

async function workerAction(id) {
  const actionButton = document.getElementById("modalActionBtn");
  actionButton.disabled = true;
  try {
    await api(`/complaints/${id}/start`, { method: "PATCH", body: {} });
    await loadWorker();
    closeModal();
    render();
    notify("Work started.", "success");
  } catch (error) {
    notify(error.message || "Unable to update work status.");
  } finally {
    actionButton.disabled = false;
  }
}

async function submitResolutionProof(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');
  const problemFound = document.getElementById("problemFound").value.trim();
  const resolutionSummary = document.getElementById("resolutionSummary").value.trim();
  const files = [...document.getElementById("resolutionProofFiles").files];
  const unsupported = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type));
  const oversized = files.find((file) => file.size > 5 * 1024 * 1024);
  if (!problemFound || !resolutionSummary || !files.length) return notify("Describe the work and attach proof media.");
  if (unsupported) return notify(`${unsupported.name} is not a supported proof image.`);
  if (oversized) return notify(`${oversized.name} exceeds the 5 MB limit.`);
  submitButton.disabled = true;
  try {
    const uploads = await Promise.all(files.map(async (file) => {
      const data = new FormData();
      data.append("file", file);
      return api(`/complaints/${workerState.active.id}/attachments`, { method: "POST", body: data });
    }));
    await api(`/complaints/${workerState.active.id}/resolve`, {
      method: "PATCH",
      body: { problemFound, resolutionSummary, proofAttachmentIds: uploads.map((upload) => upload.data.id) },
    });
    await loadWorker();
    closeModal();
    render();
    notify("Proof submitted for authority verification.", "success");
  } catch (error) {
    notify(error.message || "Unable to submit proof of work.");
    submitButton.disabled = false;
  }
}

function renderLoading() {
  document.getElementById("pageContent").innerHTML = '<section class="content-card loading-state" aria-live="polite"><p>Loading your assigned maintenance work…</p></section>';
}

function bindShell() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.onclick = (event) => { event.preventDefault(); render(item.dataset.page); };
  });
  document.querySelectorAll(".signout-btn, .dropdown-signout").forEach((button) => { button.onclick = () => window.UrbanityApi.logout(); });
  const dropdownToggle = document.getElementById("profileDropdownToggle");
  dropdownToggle.onclick = () => {
    const menu = document.getElementById("dropdownMenu");
    const isOpen = menu.classList.toggle("show");
    dropdownToggle.setAttribute("aria-expanded", String(isOpen));
  };
  document.getElementById("viewProfileButton").onclick = () => { document.getElementById("dropdownMenu").classList.remove("show"); dropdownToggle.setAttribute("aria-expanded", "false"); render("profile"); };
  document.getElementById("helpButton").onclick = () => { document.getElementById("dropdownMenu").classList.remove("show"); dropdownToggle.setAttribute("aria-expanded", "false"); };
  document.getElementById("modalCloseButton").onclick = closeModal;
  document.getElementById("modalOverlay").onclick = (event) => { if (event.target.id === "modalOverlay") closeModal(); };
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.UrbanityApi?.getAccessToken()) return window.UrbanityApi?.logout();
  bindShell();
  renderLoading();
  try {
    await loadWorker();
    render();
  } catch (error) {
    document.getElementById("pageContent").innerHTML = '<section class="content-card empty-state"><p>Unable to load maintenance work. Please try again.</p></section>';
    notify(error.message || "Unable to load the Maintenance Worker portal.");
  }
});
