const ADMIN_MODULES = [
  "dashboard",
  "system-issues",
  "community-management",
  "subscription",
  "users-roles",
  "users",
  "activity-monitor",
  "profile",
];

const ADMIN_PAGE_STATE_KEY = "urbanity.admin.lastPage";
let authenticatedAdmin = false;
let authenticatedAdminUser = null;

// A failed mutation must remain in the current workspace so its error can be
// shown there. Initial authentication continues to use UrbanityApi directly.
function adminApiRequest(path, options = {}) {
  return window.UrbanityApi.apiRequest(path, { ...options, redirectOnUnauthorized: false });
}

// This file is loaded only by the Community Admin portal. Native form
// navigation is never valid here; every form is handled asynchronously below.
document.addEventListener("submit", (event) => {
  event.preventDefault();
}, true);

function showAdminToast(message, type = "info") {
  if (window.UIFeedback?.toast) {
    window.UIFeedback.toast({ scope: "admin", message, type });
    return;
  }
  console[type === "error" ? "error" : "log"](message);
}

function showAdminDialog({ title, message, confirmText, cancelText, inputValue }) {
  if (window.UIFeedback?.dialog) {
    return window.UIFeedback.dialog({
      title,
      message,
      confirmText,
      cancelText,
      inputValue,
    });
  }
  return Promise.resolve({ confirmed: false, value: null });
}

function getCurrentSessionUser() {
  return authenticatedAdminUser || window.UrbanityApi?.getStoredUser() || null;
}

function applyCurrentUserToAdminUI() {
  const currentUser = getCurrentSessionUser();
  if (!currentUser) {
    return;
  }

  const displayName = currentUser.name || currentUser.email?.split("@")[0] || "Community Admin";
  const initials = displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const headerName = document.querySelector(".user-name");
  const headerEmail = document.querySelector(".user-email");
  const headerAvatar = document.querySelector(".user-avatar");

  if (headerName) headerName.textContent = displayName;
  if (headerEmail) headerEmail.textContent = currentUser.email || "";
  if (headerAvatar) headerAvatar.textContent = initials;

  const profileName = document.getElementById("adminProfileName");
  const infoName = document.getElementById("adminInfoName");
  const infoEmail = document.getElementById("adminInfoEmail");
  const profileAvatar = document.getElementById("adminProfileAvatar");

  if (profileName) profileName.textContent = displayName;
  if (infoName) infoName.textContent = displayName;
  if (infoEmail) infoEmail.textContent = currentUser.email || "";
  if (profileAvatar) profileAvatar.textContent = initials;

  const profilePage = document.getElementById("page-profile");
  if (profilePage) {
    const towers = hierarchyState.towers.length;
    const floors = hierarchyState.floors.length;
    const residents = userManagementState.users.filter((user) => user.role === "RESIDENT").length;
    const openComplaints = complaintManagementState.complaints.filter((item) => !["RESOLVED", "REVIEWED", "CLOSED"].includes(item.status)).length;
    profilePage.innerHTML = `<div class="page-header-with-action"><div><h1 class="page-title">Community Admin Profile</h1><p class="page-description">Your authenticated access, community scope, and operational overview.</p></div><button class="btn btn-primary" type="button" id="editCommunityAdminProfile">Edit profile</button></div><section class="community-profile-hero"><div class="community-profile-avatar">${hierarchyEscape(initials)}</div><div><p>COMMUNITY ADMIN</p><h2>${hierarchyEscape(displayName)}</h2><span>${hierarchyEscape(currentUser.email || "Not available")}</span></div><div class="community-profile-status">✓ Active authenticated session</div></section><div class="community-profile-grid"><section class="card"><div class="card-header"><h3 class="card-title">Account &amp; access</h3></div><div class="card-content profile-detail-grid"><div><span>Role</span><b>Community Admin</b></div><div><span>Community scope</span><b>${hierarchyEscape(hierarchyState.communities.map((community) => community.name).join(", ") || "Loading community")}</b></div><div><span>Email</span><b>${hierarchyEscape(currentUser.email || "Not available")}</b></div><div><span>Permissions</span><b>Community operations</b></div></div></section><section class="card"><div class="card-header"><h3 class="card-title">Your community at a glance</h3></div><div class="card-content community-profile-stats"><div><b>${towers}</b><span>Towers</span></div><div><b>${floors}</b><span>Floors</span></div><div><b>${residents}</b><span>Residents</span></div><div><b>${openComplaints}</b><span>Open complaints</span></div></div></section></div><section class="card"><div class="card-header"><h3 class="card-title">Quick actions</h3></div><div class="card-content community-profile-actions"><button type="button" class="btn btn-outline" data-community-admin-page="users-roles">Manage residents</button><button type="button" class="btn btn-outline" data-community-admin-page="users-roles">Set up towers &amp; floors</button><button type="button" class="btn btn-outline" data-community-admin-page="system-issues">Review complaints</button><button type="button" class="btn btn-outline" data-community-admin-page="activity-monitor">View reports</button></div></section>`;
    document.getElementById("editCommunityAdminProfile")?.addEventListener("click", editCommunityAdminProfile);
    profilePage.querySelectorAll("[data-community-admin-page]").forEach((button) => button.addEventListener("click", () => navigateTo(button.textContent.includes("towers") ? "community-management" : button.textContent.includes("residents") ? "users" : button.dataset.communityAdminPage)));
  }
}

async function editCommunityAdminProfile() {
  const currentUser = getCurrentSessionUser();
  if (!currentUser?.id) return;
  document.getElementById("communityAdminProfileModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "communityAdminProfileModal";
  overlay.className = "modal-overlay active";
  overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3 class="modal-title">Edit Profile</h3><button class="modal-close" type="button" data-close>&times;</button></div><form id="communityAdminProfileForm"><div class="modal-body"><label class="form-label">Full name</label><input class="form-input" name="name" value="${hierarchyEscape(currentUser.name || "")}" required><label class="form-label">Email</label><input class="form-input" type="email" name="email" value="${hierarchyEscape(currentUser.email || "")}" required><label class="form-label">Phone</label><input class="form-input" name="phone" value="${hierarchyEscape(currentUser.phone || "")}" placeholder="Optional phone number"></div><div class="modal-footer"><button class="btn btn-outline" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save changes</button></div></form></div>`;
  const close = () => overlay.remove();
  overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-close]")) close(); });
  overlay.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const body = { name: values.name.trim(), email: values.email.trim() };
      if (values.phone.trim()) body.phone = values.phone.trim();
    await adminApiRequest(`/users/${currentUser.id}`, { method: "PATCH", body });
      authenticatedAdminUser = await window.UrbanityApi.getCurrentUser();
      applyCurrentUserToAdminUI();
      close();
      showAdminToast("Profile updated successfully.", "success");
    } catch (error) { showAdminToast(error.message || "Unable to update profile.", "error"); submit.disabled = false; }
  };
  document.body.appendChild(overlay);
}

function hasPermission(moduleName, action) {
  return authenticatedAdmin && ADMIN_MODULES.includes(moduleName) && Boolean(action);
}

function persistAdminPage(page) {
  sessionStorage.setItem(ADMIN_PAGE_STATE_KEY, page);
}

function getSavedAdminPage() {
  const saved = sessionStorage.getItem(ADMIN_PAGE_STATE_KEY);
  if (!saved) {
    return "dashboard";
  }

  return ADMIN_MODULES.includes(saved) ? saved : "dashboard";
}

// Navigation
function navigateTo(page, evt) {
  if (!hasPermission(page, "read")) {
    showAdminToast("You do not have permission to access this module.", "error");
    return;
  }

  const resolvedPage = page === "users" ? "users-roles" : page;
  if (page === "community-management") showCommunityManagement();
  if (page === "subscription") showSubscriptionManagement();
  // Hide all pages
  const pages = document.querySelectorAll('[id^="page-"]');
  pages.forEach((p) => p.classList.add("hidden"));

  // Show selected page
  const selectedPage = document.getElementById("page-" + resolvedPage);
  if (selectedPage) {
    selectedPage.classList.remove("hidden");
  }

  // Update navigation active state
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => item.classList.remove("active"));

  const triggerEvent = evt || window.event;
  const triggerItem = triggerEvent?.target?.closest(".nav-item");
  if (triggerItem) {
    triggerItem.classList.add("active");
  } else {
    const matched = document.querySelector(`.nav-item[onclick*="'${page}'"]`);
    if (matched) {
      matched.classList.add("active");
    }
  }

  persistAdminPage(page);
  if (page === "users") showUsersWorkspace();
  if (page === "dashboard" || page === "activity-monitor") refreshAdminAnalytics();
}

function navigateToManagementTab(tabId) {
  navigateTo("users-roles");
  const tab = document.querySelector(`[onclick*="'${tabId}'"]`);
  if (tab) tab.click();
}

// Tab Switching
function switchTab(group, tabId, evt) {
  const triggerEvent = evt || window.event;
  const target = triggerEvent?.target;
  if (!target) {
    return;
  }

  // Get all tabs and content in this group
  const tabButtons = target.parentElement.querySelectorAll(".tab-button");
  const tabContents = target.closest(".tabs").querySelectorAll(".tab-content");

  // Remove active class from all
  tabButtons.forEach((btn) => btn.classList.remove("active"));
  tabContents.forEach((content) => content.classList.remove("active"));

  // Add active class to clicked tab
  target.classList.add("active");

  // Show corresponding content
  const contentElement = document.getElementById("tab-" + tabId);
  if (contentElement) {
    contentElement.classList.add("active");
  }
}

// Modal Functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    if (modalId === "addSystemIssueModal") {
      resetAddSystemIssueForm();
    }
    if (modalId === "addRuleModal" && !adminEscalationState.editingRuleId) {
      resetAddEscalationRuleForm();
    }
    if (modalId === "addRuleModal") {
      syncEscalationRuleModalMode();
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    if (modalId === "addRuleModal") {
      adminEscalationState.editingRuleId = null;
      syncEscalationRuleModalMode();
    }
  }
}

// Dropdown Functions
function toggleDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  dropdown.classList.toggle("active");
}

function closeDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  dropdown.classList.remove("active");
}

function signOut() {
  window.UrbanityApi.logout();
}

document.querySelector(".signout-btn")?.addEventListener("click", signOut);
document.querySelector(".dropdown-signout")?.addEventListener("click", signOut);

const ADMIN_STORE_KEY = "urbanityAdminCrudData";
const ADMIN_ESCALATION_RULES_KEY = "urbanity.admin.escalationRules";
const ADMIN_TECHNICAL_ISSUES_KEY = "urbanity.admin.technicalIssues";
const hierarchyState = { communities: [], towers: [], floors: [], apartments: [] };
const userManagementState = { users: [] };
const workforceManagementState = { workers: [] };
const complaintManagementState = { complaints: [], loaded: false, filter: { type: "", status: "", workType: "" } };
let activeManagedComplaintModal = null;
let activeManagedAttachmentPreview = null;
const managedAttachmentBlobUrls = new Set();
const managedAssignmentState = { assigning: false, requestId: 0 };
const managedLifecycleState = { updating: false, requestId: 0 };
const managedReviewState = { requestId: 0 };
const adminAnalyticsState = { loading: false };
const WORKER_SPECIALIZATIONS = ["PLUMBING", "ELECTRICAL", "CARPENTRY", "HVAC", "LIFT_MAINTENANCE", "CLEANING", "GENERAL_MAINTENANCE"];
const ADMIN_MANAGED_WORKER_STATUSES = ["AVAILABLE", "ON_LEAVE", "INACTIVE"];

const hierarchyEscape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const analyticsCount = (items, field, value) => items.filter((item) => item[field] === value).length;
const analyticsCard = (label, value) => `<div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;"><div class="text-sm" style="color:#6b7280;">${hierarchyEscape(label)}</div><div style="font-size:24px;font-weight:700;color:#111827;margin-top:4px;">${value}</div></div>`;

function renderAdminAnalyticsLoading() {
  const dashboard = document.getElementById("page-dashboard");
  if (dashboard) dashboard.innerHTML = '<section class="community-dashboard-loading"><span class="dashboard-loader"></span><div><p class="eyebrow">COMMUNITY OPERATIONS</p><h1>Preparing your live workspace</h1><p>Loading community, resident, complaint, and workforce data.</p></div></section>';
}

function renderAdminAnalytics(data, unavailable = []) {
  const complaints = data.complaints || [], workers = data.workers || [], communities = data.communities || [], towers = data.towers || [], floors = data.floors || [], apartments = data.apartments || [], users = data.users || [];
  const status = (value) => analyticsCount(complaints, "status", value), type = (value) => analyticsCount(complaints, "type", value), workerStatus = (value) => analyticsCount(workers, "status", value);
  const totalCompleted = workers.reduce((sum, worker) => sum + Number(worker.completedWorkCount || 0), 0);
  const averageRating = workers.length ? (workers.reduce((sum, worker) => sum + Number(worker.rating || 0), 0) / workers.length).toFixed(2) : "0.00";
  const occupiedApartments = users.filter((user) => user.role === "RESIDENT" && user.apartmentId).length;
  const vacantApartments = Math.max(apartments.length - occupiedApartments, 0);
  const statusCards = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REVIEWED", "CLOSED"].map((value) => analyticsCard(complaintLabel(value), status(value))).join("");
  const workTypeCards = [...new Set(complaints.map((item) => item.requiredWorkType).filter(Boolean))].map((value) => analyticsCard(`${complaintLabel(value)} Complaints`, analyticsCount(complaints, "requiredWorkType", value))).join("");
  const warning = unavailable.length ? `<p class="text-sm" style="color:#b45309;margin-bottom:16px;">Some metrics are unavailable: ${hierarchyEscape(unavailable.join(", "))}.</p>` : "";
  const recent = [...complaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  const dashboard = document.getElementById("page-dashboard");
  if (dashboard) dashboard.innerHTML = `<div class="page-header-with-action"><div><h1 class="page-title">Community Operations Dashboard</h1><p class="page-description">A live overview of your community structure, residents, complaints, and maintenance workforce.</p></div><button class="btn btn-outline" id="refreshCommunityDashboard">Refresh</button></div>${warning}<div class="stats-grid">${analyticsCard("Total Towers", towers.length)}${analyticsCard("Total Floors", floors.length)}${analyticsCard("Total Apartments", apartments.length)}${analyticsCard("Occupied Apartments", occupiedApartments)}${analyticsCard("Vacant Apartments", vacantApartments)}${analyticsCard("Total Residents", analyticsCount(users, "role", "RESIDENT"))}${analyticsCard("Open Complaints", complaints.filter((item) => !["RESOLVED", "REVIEWED", "CLOSED"].includes(item.status)).length)}${analyticsCard("Available Workers", workerStatus("AVAILABLE"))}</div><div class="grid-3" style="grid-template-columns:2fr 1fr;margin:24px 0;"><section class="card"><div class="card-header"><h3 class="card-title">Complaint Status</h3></div><div class="card-content"><div class="grid-4">${statusCards}</div></div></section><section class="card"><div class="card-header"><h3 class="card-title">Community Occupancy</h3></div><div class="card-content" style="display:grid;gap:10px;">${analyticsCard("Occupied", occupiedApartments)}${analyticsCard("Vacant", vacantApartments)}${analyticsCard("Apartments", apartments.length)}</div></section></div><div class="grid-3" style="margin-bottom:24px;"><section class="card"><div class="card-header"><h3 class="card-title">Complaint Types</h3></div><div class="card-content" style="display:grid;gap:10px;">${analyticsCard("Apartment", type("APARTMENT"))}${analyticsCard("Tower", type("TOWER"))}${analyticsCard("Community", type("COMMUNITY"))}</div></section><section class="card"><div class="card-header"><h3 class="card-title">Maintenance Workforce</h3></div><div class="card-content" style="display:grid;gap:10px;">${analyticsCard("Available", workerStatus("AVAILABLE"))}${analyticsCard("Busy", workerStatus("BUSY"))}${analyticsCard("On Leave", workerStatus("ON_LEAVE"))}${analyticsCard("Inactive", workerStatus("INACTIVE"))}</div></section><section class="card"><div class="card-header"><h3 class="card-title">Performance</h3></div><div class="card-content" style="display:grid;gap:10px;">${analyticsCard("Under Review", status("UNDER_REVIEW"))}${analyticsCard("Assigned", status("ASSIGNED"))}${analyticsCard("In Progress", status("IN_PROGRESS"))}${analyticsCard("Awaiting Review", status("RESOLVED"))}${analyticsCard("Closed", status("CLOSED"))}${analyticsCard("Average Worker Rating", averageRating)}</div></section></div><section class="card"><div class="card-header"><h3 class="card-title">Recent Complaints</h3></div><div class="card-content"><div style="overflow:auto;"><table><thead><tr><th>Complaint</th><th>Location</th><th>Type</th><th>Status</th><th>Created</th></tr></thead><tbody>${recent.length ? recent.map((item) => `<tr><td>${hierarchyEscape(item.title)}</td><td>${hierarchyEscape(complaintLocation(item))}</td><td>${hierarchyEscape(complaintLabel(item.type))}</td><td>${hierarchyEscape(complaintLabel(item.status))}</td><td>${hierarchyEscape(new Date(item.createdAt).toLocaleString())}</td></tr>`).join("") : '<tr><td colspan="5">No complaints found.</td></tr>'}</tbody></table></div></div></section>`;
  document.getElementById("refreshCommunityDashboard")?.addEventListener("click", refreshAdminAnalytics);
  const reports = document.getElementById("page-activity-monitor");
  if (reports) reports.innerHTML = `<div class="page-header-with-action"><div><h1 class="page-title">Community Reports</h1><p class="page-description">Backend-derived complaint, workforce, and community structure report.</p></div><button class="btn btn-outline" id="refreshCommunityReports">Refresh</button></div>${warning}<div class="grid-3"><section class="card"><div class="card-header"><h3 class="card-title">Complaint Summary</h3></div><div class="card-content" style="display:grid;gap:10px;">${analyticsCard("Total Complaints", complaints.length)}${statusCards}${workTypeCards}</div></section><section class="card"><div class="card-header"><h3 class="card-title">Workforce Report</h3></div><div class="card-content" style="display:grid;gap:10px;">${analyticsCard("Available", workerStatus("AVAILABLE"))}${analyticsCard("Busy", workerStatus("BUSY"))}${analyticsCard("On Leave", workerStatus("ON_LEAVE"))}${analyticsCard("Inactive", workerStatus("INACTIVE"))}${analyticsCard("Completed Works", totalCompleted)}${analyticsCard("Average Rating", averageRating)}</div></section><section class="card"><div class="card-header"><h3 class="card-title">Community Structure</h3></div><div class="card-content" style="display:grid;gap:10px;">${analyticsCard("Communities", communities.length)}${analyticsCard("Towers", towers.length)}${analyticsCard("Floors", floors.length)}${analyticsCard("Apartments", apartments.length)}${analyticsCard("Community Admins", analyticsCount(users, "role", "COMMUNITY_ADMIN"))}</div></section></div>`;
  document.getElementById("refreshCommunityReports")?.addEventListener("click", refreshAdminAnalytics);
  renderProfessionalCommunityDashboard(data, unavailable);
}

function renderProfessionalCommunityDashboard(data, unavailable = []) {
  const dashboard = document.getElementById("page-dashboard");
  if (!dashboard) return;
  const complaints = data.complaints || [], workers = data.workers || [], towers = data.towers || [], floors = data.floors || [], apartments = data.apartments || [], users = data.users || [];
  const residents = users.filter((user) => user.role === "RESIDENT");
  const occupied = residents.filter((user) => user.apartmentId).length;
  const vacant = Math.max(apartments.length - occupied, 0);
  const openStatuses = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"];
  const openCount = complaints.filter((item) => openStatuses.includes(item.status)).length;
  const available = workers.filter((worker) => worker.status === "AVAILABLE").length;
  const occupancy = apartments.length ? Math.round((occupied / apartments.length) * 100) : null;
  const pending = complaints.filter((item) => item.status === "SUBMITTED" || (item.status === "UNDER_REVIEW" && !item.assignedWorkerId) || item.status === "REVIEWED");
  const statusOrder = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REVIEWED", "CLOSED"];
  const statusRows = statusOrder.map((value) => { const count = analyticsCount(complaints, "status", value); const percent = complaints.length ? Math.round((count / complaints.length) * 100) : 0; return `<div class="workflow-row"><span class="status-dot status-${value.toLowerCase()}"></span><span>${hierarchyEscape(complaintLabel(value))}</span><div class="workflow-track"><i style="width:${percent}%"></i></div><b>${count}</b><small>${percent}%</small></div>`; }).join("");
  const userName = (workerId) => { const worker = workers.find((item) => item.id === workerId); return users.find((item) => item.id === worker?.userId)?.name || "Unassigned"; };
  const recent = [...complaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  const warning = unavailable.length ? `<div class="dashboard-warning">Some live metrics are currently unavailable: ${hierarchyEscape(unavailable.join(", "))}.</div>` : "";
  dashboard.innerHTML = `<section class="community-dashboard-hero"><div><p class="eyebrow">COMMUNITY OPERATIONS</p><h1>Good ${new Date().getHours() < 12 ? "morning" : "day"}, Community Admin</h1><p>Monitor occupancy, maintenance activity, and resident issues from one live workspace.</p></div><div class="dashboard-hero-actions"><button type="button" class="btn btn-primary" data-dashboard-page="community-management">Manage community</button><button type="button" class="btn btn-outline" id="refreshCommunityDashboard">Refresh data</button></div></section>${warning}<section class="dashboard-kpis"><article><span class="kpi-icon">⌂</span><div><small>Total apartments</small><b>${apartments.length}</b><em>${occupied} occupied</em></div></article><article><span class="kpi-icon kpi-green">●</span><div><small>Occupancy</small><b>${occupancy === null ? "—" : `${occupancy}%`}</b><em>${vacant} vacant apartments</em></div></article><article><span class="kpi-icon kpi-orange">!</span><div><small>Open complaints</small><b>${openCount}</b><em>${pending.length} need action</em></div></article><article><span class="kpi-icon kpi-purple">♧</span><div><small>Available workers</small><b>${available}</b><em>${workers.length} workforce profiles</em></div></article></section><section class="dashboard-layout"><div class="dashboard-main-column"><article class="dashboard-panel"><div class="panel-heading"><div><p class="eyebrow">SERVICE DELIVERY</p><h2>Complaint operations</h2></div><button type="button" class="btn-link" data-dashboard-page="system-issues">View all complaints</button></div><div class="workflow-list">${statusRows}</div></article><article class="dashboard-panel"><div class="panel-heading"><div><p class="eyebrow">LATEST ACTIVITY</p><h2>Recent complaints</h2></div></div><div class="dashboard-table-wrap"><table><thead><tr><th>Complaint</th><th>Location</th><th>Status</th><th>Assigned to</th><th></th></tr></thead><tbody>${recent.length ? recent.map((item) => `<tr><td><b>${hierarchyEscape(item.title)}</b><small>${hierarchyEscape(complaintLabel(item.requiredWorkType))}</small></td><td>${hierarchyEscape(complaintLocation(item))}</td><td><span class="status-badge status-${String(item.status).toLowerCase()}">${hierarchyEscape(complaintLabel(item.status))}</span></td><td>${hierarchyEscape(userName(item.assignedWorkerId))}</td><td><button type="button" class="btn-link dashboard-complaint-action" data-id="${item.id}">Open</button></td></tr>`).join("") : '<tr><td colspan="5" class="dashboard-empty">No complaints have been submitted yet.</td></tr>'}</tbody></table></div></article></div><aside class="dashboard-side-column"><article class="dashboard-panel occupancy-panel"><p class="eyebrow">COMMUNITY HEALTH</p><h2>Occupancy snapshot</h2><div class="occupancy-meter" style="--occupancy:${occupancy ?? 0}%"><div><b>${occupancy === null ? "—" : `${occupancy}%`}</b><span>occupied</span></div></div><div class="occupancy-stats"><span><b>${occupied}</b> Occupied</span><span><b>${vacant}</b> Vacant</span></div></article><article class="dashboard-panel"><div class="panel-heading"><div><p class="eyebrow">ACTION REQUIRED</p><h2>Admin queue</h2></div></div><div class="attention-list">${pending.length ? pending.slice(0, 4).map((item) => `<button type="button" class="attention-item dashboard-complaint-action" data-id="${item.id}"><span><b>${hierarchyEscape(item.title)}</b><small>${hierarchyEscape(complaintLabel(item.status))} · ${hierarchyEscape(complaintLocation(item))}</small></span><i>›</i></button>`).join("") : '<p class="dashboard-empty">Nothing needs your attention right now.</p>'}</div></article><article class="dashboard-panel quick-panel"><p class="eyebrow">QUICK ACTIONS</p><h2>Manage your community</h2><button type="button" data-dashboard-page="community-management">Add tower, floor, or apartment <i>›</i></button><button type="button" data-dashboard-page="users">Create resident or worker <i>›</i></button><button type="button" data-dashboard-page="system-issues">Review complaints <i>›</i></button></article></aside></section>`;
  dashboard.querySelector("#refreshCommunityDashboard")?.addEventListener("click", refreshAdminAnalytics);
  dashboard.querySelectorAll("[data-dashboard-page]").forEach((button) => button.onclick = () => navigateTo(button.dataset.dashboardPage));
  dashboard.querySelectorAll(".dashboard-complaint-action").forEach((button) => button.onclick = () => { navigateTo("system-issues"); viewManagedComplaint(button.dataset.id); });
}

function appendOperationalDashboard(data) {
  const dashboard = document.getElementById("page-dashboard");
  if (!dashboard) return;
  const complaints = data.complaints || [];
  const apartments = data.apartments || [];
  const users = data.users || [];
  const towers = data.towers || [];
  const floors = data.floors || [];
  const open = (item) => !["RESOLVED", "REVIEWED", "CLOSED"].includes(item.status);
  const required = complaints.filter((item) => item.status === "SUBMITTED" || (item.status === "UNDER_REVIEW" && !item.assignedWorkerId) || item.status === "REVIEWED");
  const residentFor = (id) => users.find((user) => user.role === "RESIDENT" && user.apartmentId === id);
  const towerRows = towers.map((tower) => {
    const towerFloors = floors.filter((floor) => floor.towerId === tower.id);
    const towerApartments = apartments.filter((apartment) => towerFloors.some((floor) => floor.id === apartment.floorId));
    const occupied = towerApartments.filter((apartment) => residentFor(apartment.id)).length;
    const towerOpen = complaints.filter((complaint) => open(complaint) && (complaint.towerId === tower.id || towerApartments.some((apartment) => apartment.id === complaint.apartmentId))).length;
    return `<tr><td><button type="button" class="btn-link tower-dashboard-link">${hierarchyEscape(tower.name)}</button></td><td>${towerFloors.length}</td><td>${towerApartments.length}</td><td>${occupied}</td><td>${towerApartments.length - occupied}</td><td>${towerOpen}</td></tr>`;
  }).join("");
  dashboard.insertAdjacentHTML("beforeend", `<div class="grid-2" style="margin-top:24px;"><section class="card"><div class="card-header"><h3 class="card-title">Action Required</h3></div><div class="card-content"><div style="overflow:auto"><table><thead><tr><th>Complaint</th><th>Location</th><th>Status</th><th>Action</th></tr></thead><tbody>${required.length ? required.map((item) => `<tr><td>${hierarchyEscape(item.title)}</td><td>${hierarchyEscape(complaintLocation(item))}</td><td>${hierarchyEscape(complaintLabel(item.status))}</td><td><button type="button" class="btn btn-outline btn-sm dashboard-complaint-action" data-id="${item.id}">${item.status === "SUBMITTED" ? "Review complaint" : item.status === "REVIEWED" ? "Close complaint" : "Assign worker"}</button></td></tr>`).join("") : '<tr><td colspan="4">No complaints currently require action.</td></tr>'}</tbody></table></div></div></section><section class="card"><div class="card-header"><h3 class="card-title">Quick Actions</h3></div><div class="card-content community-profile-actions"><button class="btn btn-outline" type="button" data-dashboard-page="users-roles">Add Tower</button><button class="btn btn-outline" type="button" data-dashboard-page="users-roles">Add Floor</button><button class="btn btn-outline" type="button" data-dashboard-page="users-roles">Add Apartment</button><button class="btn btn-outline" type="button" data-dashboard-page="users">Create Resident</button><button class="btn btn-outline" type="button" data-dashboard-page="users">Create Worker</button><button class="btn btn-outline" type="button" data-dashboard-page="system-issues">View Complaints</button></div></section></div><section class="card" style="margin-top:24px"><div class="card-header"><h3 class="card-title">Tower Overview</h3></div><div class="card-content"><div style="overflow:auto"><table><thead><tr><th>Tower</th><th>Floors</th><th>Apartments</th><th>Occupied</th><th>Vacant</th><th>Open Complaints</th></tr></thead><tbody>${towerRows || '<tr><td colspan="6">No towers found.</td></tr>'}</tbody></table></div></div></section>`);
  dashboard.querySelectorAll(".dashboard-complaint-action").forEach((button) => button.onclick = () => { navigateTo("system-issues"); viewManagedComplaint(button.dataset.id); });
  dashboard.querySelectorAll("[data-dashboard-page]").forEach((button) => button.onclick = () => navigateTo(button.textContent.startsWith("Add") ? "community-management" : button.dataset.dashboardPage));
  dashboard.querySelectorAll(".tower-dashboard-link").forEach((button) => button.onclick = () => navigateTo("users-roles"));
}

async function refreshAdminAnalytics() {
  if (adminAnalyticsState.loading) return;
  adminAnalyticsState.loading = true;
  renderAdminAnalyticsLoading();
  const resources = { complaints: "/complaints", workers: "/workforce/workers", communities: "/communities", towers: "/towers", floors: "/floors", apartments: "/apartments", users: "/users" };
  try {
    const results = await Promise.allSettled(Object.entries(resources).map(async ([key, path]) => [key, await adminApiRequest(path)]));
    const data = {}, unavailable = [];
    results.forEach((result, index) => { const key = Object.keys(resources)[index]; if (result.status === "fulfilled") data[key] = result.value[1].data || []; else { data[key] = []; unavailable.push(key); } });
    renderAdminAnalytics(data, unavailable);
  } finally {
    adminAnalyticsState.loading = false;
  }
}

async function loadHierarchyData() {
  const [communities, towers, floors, apartments] = await Promise.all([
    adminApiRequest("/communities"),
    adminApiRequest("/towers"),
    adminApiRequest("/floors"),
    adminApiRequest("/apartments"),
  ]);
  hierarchyState.communities = communities.data || [];
  hierarchyState.towers = towers.data || [];
  hierarchyState.floors = floors.data || [];
  hierarchyState.apartments = apartments.data || [];
}

function hierarchyOptions(items, selectedId, labelFor) {
  return `<option value="">Select parent</option>${items.map((item) => `<option value="${item.id}" ${item.id === selectedId ? "selected" : ""}>${hierarchyEscape(labelFor(item))}</option>`).join("")}`;
}

function showCommunityManagement() {
  let page = document.getElementById("page-community-management");
  if (!page) {
    page = document.createElement("div");
    page.id = "page-community-management";
    page.className = "hidden";
    document.getElementById("pageContent")?.appendChild(page);
  }
  page.innerHTML = `<div class="page-header"><h1 class="page-title">Community Management</h1><p class="page-description">Manage your physical community structure: towers, floors, and apartments.</p></div><div id="communityManagementHierarchy"></div>`;
  renderHierarchyManagement();
}

function renderHierarchyManagement() {
  const container = document.getElementById("communityManagementHierarchy");
  if (!container) return;
  const communityName = (id) => hierarchyState.communities.find((item) => item.id === id)?.name || "Unknown community";
  const towerName = (id) => hierarchyState.towers.find((item) => item.id === id)?.name || "Unknown tower";
  const floorName = (id) => hierarchyState.floors.find((item) => item.id === id)?.label || "Unknown floor";
  const list = (title, rows, empty) => `<section class="card" style="margin-bottom:20px;"><div class="card-header"><h3 class="card-title">${title}</h3></div><div class="card-content">${rows.length ? `<div style="overflow:auto;"><table><tbody>${rows.join("")}</tbody></table></div>` : `<p>${empty}</p>`}</div></section>`;
  container.innerHTML = `<div class="card"><div class="card-header"><h3 class="card-title">Community Hierarchy Management</h3></div><div class="card-content"><p style="margin-bottom:16px;">Community → Tower → Floor → Apartment</p><div class="grid-2"><form id="communityForm"><h4>Community</h4><input class="form-input" name="name" placeholder="Community name" required><input class="form-input" name="address" placeholder="Community address" required><textarea class="form-input" name="description" placeholder="Description (optional)"></textarea><button class="btn btn-primary" type="submit">Add Community</button></form><form id="towerForm"><h4>Tower</h4><select class="form-select" name="communityId" required>${hierarchyOptions(hierarchyState.communities, "", (item) => item.name)}</select><input class="form-input" name="name" placeholder="Tower name" required><input class="form-input" name="code" placeholder="Tower code" required><button class="btn btn-primary" type="submit">Add Tower</button></form><form id="floorForm"><h4>Floor</h4><select class="form-select" name="towerId" required>${hierarchyOptions(hierarchyState.towers, "", (item) => `${item.name} (${communityName(item.communityId)})`)}</select><input class="form-input" name="floorNumber" type="number" min="0" placeholder="Floor number" required><input class="form-input" name="label" placeholder="Floor label" required><button class="btn btn-primary" type="submit">Add Floor</button></form><form id="apartmentForm"><h4>Apartment</h4><select class="form-select" name="floorId" required>${hierarchyOptions(hierarchyState.floors, "", (item) => `${item.label} (${towerName(item.towerId)})`)}</select><input class="form-input" name="apartmentNumber" placeholder="Apartment number" required><input class="form-input" name="label" placeholder="Apartment label" required><button class="btn btn-primary" type="submit">Add Apartment</button></form></div></div></div>${list("Communities", hierarchyState.communities.map((item) => `<tr><td><b>${hierarchyEscape(item.name)}</b><br><small>${hierarchyEscape(item.address)}</small></td><td>${hierarchyEscape(item.description || "")}</td><td><button class="btn btn-outline btn-sm" onclick="editHierarchy('communities','${item.id}')">Edit</button> <button class="btn btn-outline btn-sm" onclick="deleteHierarchy('communities','${item.id}')">Delete</button></td></tr>`), "No communities found.")}${list("Towers", hierarchyState.towers.map((item) => `<tr><td><b>${hierarchyEscape(item.name)}</b> (${hierarchyEscape(item.code)})</td><td>${hierarchyEscape(communityName(item.communityId))}</td><td><button class="btn btn-outline btn-sm" onclick="editHierarchy('towers','${item.id}')">Edit</button> <button class="btn btn-outline btn-sm" onclick="deleteHierarchy('towers','${item.id}')">Delete</button></td></tr>`), "No towers found.")}${list("Floors", hierarchyState.floors.map((item) => `<tr><td><b>${item.floorNumber}</b> · ${hierarchyEscape(item.label)}</td><td>${hierarchyEscape(towerName(item.towerId))}</td><td><button class="btn btn-outline btn-sm" onclick="editHierarchy('floors','${item.id}')">Edit</button> <button class="btn btn-outline btn-sm" onclick="deleteHierarchy('floors','${item.id}')">Delete</button></td></tr>`), "No floors found.")}${list("Apartments", hierarchyState.apartments.map((item) => `<tr><td><b>${hierarchyEscape(item.apartmentNumber)}</b> · ${hierarchyEscape(item.label)}</td><td>${hierarchyEscape(floorName(item.floorId))}</td><td><button class="btn btn-outline btn-sm" onclick="editHierarchy('apartments','${item.id}')">Edit</button> <button class="btn btn-outline btn-sm" onclick="deleteHierarchy('apartments','${item.id}')">Delete</button></td></tr>`), "No apartments found.")}`;
  // Community records are platform-owned; this portal can only display them.
  container.querySelector("#communityForm")?.remove();
  // Keep hierarchy creation entirely out of the browser's native form path.
  container.querySelectorAll("#towerForm, #floorForm, #apartmentForm").forEach((form) => {
    const panel = document.createElement("div");
    panel.id = form.id;
    panel.className = `${form.className} hierarchy-form`;
    panel.innerHTML = form.innerHTML;
    form.replaceWith(panel);
    const saveButton = panel.querySelector('button[type="submit"]');
    if (saveButton) { saveButton.type = "button"; saveButton.dataset.hierarchySave = ""; }
  });
  container.querySelectorAll("[onclick*=\"'communities'\"]").forEach((button) => button.remove());
  container.insertAdjacentHTML("afterbegin", `<div class="page-header"><h2 class="page-title">Community setup</h2><p class="page-description">Follow the required order: Tower → Floor → Apartment → Resident.</p></div><div class="hierarchy-steps"><span>1. Create tower</span><i>→</i><span>2. Add floor</span><i>→</i><span>3. Add apartment</span><i>→</i><span>4. Create &amp; associate resident</span></div>`);
  const bindHierarchyForm = (selector, resource) => {
    const panel = container.querySelector(selector);
    panel.querySelector("[data-hierarchy-save]").onclick = () => submitHierarchy(panel, resource);
  };
  bindHierarchyForm("#towerForm", "towers");
  bindHierarchyForm("#floorForm", "floors");
  bindHierarchyForm("#apartmentForm", "apartments");
  container.querySelectorAll('button:not([type])').forEach((button) => { button.type = "button"; });
  container.querySelectorAll("section.card").forEach((section, index) => { section.dataset.hierarchyRecords = ["communities", "towers", "floors", "apartments"][index]; });
}

function refreshHierarchyRecords() {
  const container = document.getElementById("communityManagementHierarchy");
  if (!container) return;
  const communityName = (id) => hierarchyState.communities.find((item) => item.id === id)?.name || "Community";
  const towerName = (id) => hierarchyState.towers.find((item) => item.id === id)?.name || "Tower";
  const floorName = (id) => hierarchyState.floors.find((item) => item.id === id)?.label || "Floor";
  const rows = {
    communities: hierarchyState.communities.map((item) => `<tr><td><b>${hierarchyEscape(item.name)}</b><br><small>${hierarchyEscape(item.address)}</small></td><td>${hierarchyEscape(item.description || "")}</td></tr>`),
    towers: hierarchyState.towers.map((item) => `<tr><td><b>${hierarchyEscape(item.name)}</b> (${hierarchyEscape(item.code)})</td><td>${hierarchyEscape(communityName(item.communityId))}</td><td><button type="button" class="btn btn-outline btn-sm" onclick="editHierarchy('towers','${item.id}')">Edit</button> <button type="button" class="btn btn-outline btn-sm" onclick="deleteHierarchy('towers','${item.id}')">Delete</button></td></tr>`),
    floors: hierarchyState.floors.map((item) => `<tr><td><b>${item.floorNumber}</b> · ${hierarchyEscape(item.label)}</td><td>${hierarchyEscape(towerName(item.towerId))}</td><td><button type="button" class="btn btn-outline btn-sm" onclick="editHierarchy('floors','${item.id}')">Edit</button> <button type="button" class="btn btn-outline btn-sm" onclick="deleteHierarchy('floors','${item.id}')">Delete</button></td></tr>`),
    apartments: hierarchyState.apartments.map((item) => `<tr><td><b>${hierarchyEscape(item.apartmentNumber)}</b> · ${hierarchyEscape(item.label)}</td><td>${hierarchyEscape(floorName(item.floorId))}</td><td><button type="button" class="btn btn-outline btn-sm" onclick="editHierarchy('apartments','${item.id}')">Edit</button> <button type="button" class="btn btn-outline btn-sm" onclick="deleteHierarchy('apartments','${item.id}')">Delete</button></td></tr>`),
  };
  container.querySelectorAll("[data-hierarchy-records]").forEach((section) => {
    const resource = section.dataset.hierarchyRecords;
    const body = section.querySelector("tbody");
    if (body) body.innerHTML = rows[resource]?.join("") || `<tr><td colspan="3">No ${resource} found.</td></tr>`;
  });
}

async function submitHierarchy(panel, resource) {
  const submitButton = panel.querySelector("[data-hierarchy-save]");
  if (submitButton?.disabled) return;
  const data = Object.fromEntries([...panel.querySelectorAll("[name]")].map((field) => [field.name, field.value]));
  if (resource === "floors") data.floorNumber = Number(data.floorNumber);
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = `Creating ${resource.slice(0, -1)}...`; }
  try { await adminApiRequest(`/${resource}`, { method: "POST", body: data }); await loadHierarchyData(); showCommunityManagement(); showAdminToast(`${resource.slice(0, -1)} created successfully.`, "success"); } catch (error) { showAdminToast(error.message || "Unable to save hierarchy record.", "error"); if (submitButton) { submitButton.disabled = false; submitButton.textContent = `Add ${resource.slice(0, -1)}`; } }
}

async function editHierarchy(resource, id) {
  const item = hierarchyState[resource].find((entry) => entry.id === id);
  if (!item) return;
  const fields = resource === "communities" ? ["name", "address", "description"] : resource === "towers" ? ["name", "code", "description"] : resource === "floors" ? ["floorNumber", "label"] : ["apartmentNumber", "label"];
  document.getElementById("hierarchyEditModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "hierarchyEditModal"; overlay.className = "modal-overlay active";
  const labels = { name: "Name", address: "Address", description: "Description", code: "Tower code", floorNumber: "Floor number", label: resource === "apartments" ? "Apartment label" : "Floor label", apartmentNumber: "Apartment number" };
  const inputs = fields.map((field) => field === "description" ? `<label class="form-label">${labels[field]}<textarea class="form-input" name="${field}" maxlength="500">${hierarchyEscape(item[field] || "")}</textarea></label>` : `<label class="form-label">${labels[field]}<input class="form-input" name="${field}" type="${field === "floorNumber" ? "number" : "text"}" value="${hierarchyEscape(item[field] ?? "")}" ${field === "floorNumber" ? "min=\"0\"" : ""} required></label>`).join("");
  overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3 class="modal-title">Edit ${resource.slice(0, -1)}</h3><button class="modal-close" type="button" data-close>&times;</button></div><form id="hierarchyEditForm"><div class="modal-body">${inputs}</div><div class="modal-footer"><button class="btn btn-outline" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save changes</button></div></form></div>`;
  const close = () => overlay.remove(); overlay.onclick = (event) => { if (event.target === overlay || event.target.closest("[data-close]")) close(); };
  overlay.querySelector("form").onsubmit = async (event) => { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); if ("floorNumber" in body) body.floorNumber = Number(body.floorNumber); const submit = event.currentTarget.querySelector('[type="submit"]'); submit.disabled = true; try { await adminApiRequest(`/${resource}/${id}`, { method: "PATCH", body }); await loadHierarchyData(); showCommunityManagement(); close(); showAdminToast("Hierarchy record updated.", "success"); } catch (error) { submit.disabled = false; showAdminToast(error.message || "Unable to update hierarchy record.", "error"); } };
  document.body.appendChild(overlay);
}

async function deleteHierarchy(resource, id) {
  if (!window.confirm("Delete this hierarchy record? Child records must be removed first.")) return;
  try { await adminApiRequest(`/${resource}/${id}`, { method: "DELETE" }); await loadHierarchyData(); refreshHierarchyRecords(); showAdminToast("Hierarchy record deleted.", "success"); } catch (error) { showAdminToast(error.message || "Unable to delete hierarchy record.", "error"); }
}

async function loadManagedUsers() {
  const response = await adminApiRequest("/users");
  userManagementState.users = response.data || [];
}

function userRoleLabel(role) { return String(role || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function apartmentChain(apartmentId) {
  const apartment = hierarchyState.apartments.find((item) => item.id === apartmentId);
  const floor = apartment && hierarchyState.floors.find((item) => item.id === apartment.floorId);
  const tower = floor && hierarchyState.towers.find((item) => item.id === floor.towerId);
  const community = tower && hierarchyState.communities.find((item) => item.id === tower.communityId);
  return apartment ? `${apartment.label || apartment.apartmentNumber} · ${floor?.label || ""} · ${tower?.name || ""} · ${community?.name || ""}` : "Unassigned";
}

let activeUsersSection = "residents";

function showUsersWorkspace(section = activeUsersSection) {
  activeUsersSection = section;
  const page = document.getElementById("page-users-roles");
  if (!page) return;
  const residents = userManagementState.users.filter((user) => user.role === "RESIDENT");
  const representatives = userManagementState.users.filter((user) => user.role === "TOWER_REPRESENTATIVE");
  const workerName = (id) => userManagementState.users.find((user) => user.id === id)?.name || "Worker account";
  const table = (rows, empty, headings) => `<section class="card"><div class="card-content"><div style="overflow:auto"><table><thead><tr>${headings.map((heading) => `<th>${heading}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headings.length}">${empty}</td></tr>`}</tbody></table></div></div></section>`;
  const residentRows = residents.map((user) => `<tr><td>${hierarchyEscape(user.name)}</td><td>${hierarchyEscape(user.email)}</td><td>${hierarchyEscape(apartmentChain(user.apartmentId))}</td><td><button type="button" class="btn btn-outline btn-sm" onclick="editManagedUser('${user.id}')">Edit</button> <button type="button" class="btn btn-outline btn-sm" onclick="deleteManagedUser('${user.id}')">Delete</button></td></tr>`).join("");
  const representativeRows = representatives.map((user) => `<tr><td>${hierarchyEscape(user.name)}</td><td>${hierarchyEscape(user.email)}</td><td>${hierarchyEscape(hierarchyState.towers.find((tower) => tower.id === user.towerId)?.name || "Not Assigned")}</td><td><button type="button" class="btn btn-outline btn-sm" onclick="editManagedUser('${user.id}')">Edit</button> <button type="button" class="btn btn-outline btn-sm" onclick="deleteManagedUser('${user.id}')">Delete</button></td></tr>`).join("");
  const workerRows = workforceManagementState.workers.map((worker) => `<tr><td>${hierarchyEscape(workerName(worker.userId))}</td><td>${hierarchyEscape(workforceLabel(worker.specialization))}</td><td>${hierarchyEscape(workforceLabel(worker.status))}</td><td>${hierarchyEscape(worker.rating)}</td><td>${hierarchyEscape(worker.completedWorkCount)}</td><td><button type="button" class="btn btn-outline btn-sm" onclick="editManagedWorker('${worker.id}')">Edit</button> <button type="button" class="btn btn-outline btn-sm" onclick="deactivateManagedWorker('${worker.id}')">Delete</button></td></tr>`).join("");
  const labels = { residents: "Resident", representatives: "Tower Representative", workers: "Worker" };
  const content = section === "residents" ? table(residentRows, "No residents found.", ["Resident", "Email", "Apartment", "Actions"]) : section === "representatives" ? table(representativeRows, "No tower representatives found.", ["Representative", "Email", "Tower", "Actions"]) : table(workerRows, "No maintenance workers found.", ["Worker", "Work Type", "Status", "Rating", "Completed Work", "Actions"]);
  page.innerHTML = `<div class="page-header-with-action"><div><h1 class="page-title">Users</h1><p class="page-description">Manage residents, tower representatives, and the shared maintenance workforce.</p></div><button type="button" class="btn btn-primary" id="openContextCreate">+ Create ${labels[section]}</button></div><div class="tabs"><div class="tab-buttons"><button class="tab-button ${section === "residents" ? "active" : ""}" type="button" data-user-section="residents">Residents</button><button class="tab-button ${section === "representatives" ? "active" : ""}" type="button" data-user-section="representatives">Tower Representatives</button><button class="tab-button ${section === "workers" ? "active" : ""}" type="button" data-user-section="workers">Workers</button></div></div>${content}`;
  page.querySelectorAll("[data-user-section]").forEach((button) => button.onclick = () => showUsersWorkspace(button.dataset.userSection));
  document.getElementById("openContextCreate").onclick = () => openContextCreateModal(section);
}

function openContextCreateModal(section) {
  document.getElementById("contextCreateModal")?.remove();
  const towerOptions = hierarchyState.towers.map((tower) => `<option value="${tower.id}">${hierarchyEscape(tower.name)}</option>`).join("");
  const workerOptions = WORKER_SPECIALIZATIONS.map((type) => `<option value="${type}">${hierarchyEscape(workforceLabel(type))}</option>`).join("");
  const extra = section === "residents" ? `<label class="form-label">Tower</label><select class="form-select" name="towerId" required><option value="">Select tower</option>${towerOptions}</select><label class="form-label">Floor</label><select class="form-select" name="floorId" required disabled><option value="">Select tower first</option></select><label class="form-label">House no.</label><select class="form-select" name="apartmentId" required disabled><option value="">Select floor first</option></select>` : section === "representatives" ? `<label class="form-label">Tower name</label><select class="form-select" name="towerId" required><option value="">Select tower</option>${towerOptions}</select>` : `<label class="form-label">Work type</label><select class="form-select" name="specialization" required><option value="">Select work type</option>${workerOptions}</select>`;
  const role = section === "residents" ? "RESIDENT" : section === "representatives" ? "TOWER_REPRESENTATIVE" : "MAINTENANCE_WORKER";
  const title = section === "residents" ? "Create Resident" : section === "representatives" ? "Create Tower Representative" : "Create Worker";
  const overlay = document.createElement("div"); overlay.id = "contextCreateModal"; overlay.className = "modal-overlay active";
  overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3 class="modal-title">${title}</h3><button type="button" class="modal-close" data-close>&times;</button></div><form id="contextCreateForm"><div class="modal-body"><label class="form-label">Name</label><input class="form-input" name="name" required><label class="form-label">Email</label><input class="form-input" type="email" name="email" required><label class="form-label">Phone</label><input class="form-input" name="phone" placeholder="Optional"><label class="form-label">Temporary password</label><input class="form-input" type="password" name="password" minlength="8" required>${extra}</div><div class="modal-footer"><button type="button" class="btn btn-outline" data-close>Cancel</button><button type="submit" class="btn btn-primary">Create</button></div></form></div>`;
  const close = () => overlay.remove(); overlay.onclick = (event) => { if (event.target === overlay || event.target.closest("[data-close]")) close(); };
  const form = overlay.querySelector("form");
  const towerSelect = form.elements.towerId, floorSelect = form.elements.floorId, apartmentSelect = form.elements.apartmentId;
  if (towerSelect && floorSelect) towerSelect.onchange = () => { const floors = hierarchyState.floors.filter((floor) => floor.towerId === towerSelect.value); floorSelect.innerHTML = `<option value="">Select floor</option>${floors.map((floor) => `<option value="${floor.id}">${hierarchyEscape(floor.label || floor.floorNumber)}</option>`).join("")}`; floorSelect.disabled = !towerSelect.value; apartmentSelect.innerHTML = '<option value="">Select floor first</option>'; apartmentSelect.disabled = true; };
  if (floorSelect && apartmentSelect) floorSelect.onchange = () => { const apartments = hierarchyState.apartments.filter((apartment) => apartment.floorId === floorSelect.value); apartmentSelect.innerHTML = `<option value="">Select house no.</option>${apartments.map((apartment) => `<option value="${apartment.id}">${hierarchyEscape(apartment.label || apartment.apartmentNumber)}</option>`).join("")}`; apartmentSelect.disabled = !floorSelect.value; };
  form.onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(form)); const submit = form.querySelector('[type="submit"]'); submit.disabled = true; try { const userBody = { name: data.name, email: data.email, password: data.password, ...(data.phone ? { phone: data.phone } : {}), role, ...(section === "residents" ? { apartmentId: data.apartmentId } : {}), ...(section === "representatives" ? { towerId: data.towerId } : {}) }; const user = (await adminApiRequest("/users", { method: "POST", body: userBody })).data; if (section === "workers") await adminApiRequest("/workforce/workers", { method: "POST", body: { userId: user.id, specialization: data.specialization, status: "AVAILABLE" } }); await Promise.all([loadManagedUsers(), loadManagedWorkers(), loadHierarchyData()]); close(); showUsersWorkspace(section); showAdminToast(`${title} created successfully.`, "success"); } catch (error) { showAdminToast(error.message || `Unable to create ${title.toLowerCase()}.`, "error"); submit.disabled = false; } };
  document.body.appendChild(overlay);
}

function renderUserManagement() {
  const container = document.getElementById("tab-users-tab");
  if (!container) return;
  const residents = userManagementState.users.filter((user) => user.role === "RESIDENT");
  const representatives = userManagementState.users.filter((user) => user.role === "TOWER_REPRESENTATIVE");
  const options = (items, labelFor) => `<option value="">Select</option>${items.map((item) => `<option value="${item.id}">${hierarchyEscape(labelFor(item))}</option>`).join("")}`;
  container.innerHTML = `<div class="card"><div class="card-header"><h3 class="card-title">Community Users</h3></div><div class="card-content"><form id="createManagedUserForm" class="grid-2"><input class="form-input" name="name" placeholder="Full name" required><input class="form-input" type="email" name="email" placeholder="Email" required><input class="form-input" type="password" name="password" placeholder="Temporary password" minlength="8" required><input class="form-input" name="phone" placeholder="Phone (optional)"><select class="form-select" name="role" required><option value="">Select role</option><option value="COMMUNITY_ADMIN">Community Admin</option><option value="TOWER_REPRESENTATIVE">Tower Representative</option><option value="RESIDENT">Resident</option><option value="MAINTENANCE_WORKER">Maintenance Worker</option></select><button class="btn btn-primary" type="submit">Create User</button></form></div></div><div class="card"><div class="card-content"><div style="overflow:auto;"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Hierarchy Association</th><th>Actions</th></tr></thead><tbody>${userManagementState.users.length ? userManagementState.users.map((user) => `<tr><td>${hierarchyEscape(user.name)}</td><td>${hierarchyEscape(user.email)}</td><td>${hierarchyEscape(userRoleLabel(user.role))}</td><td>${user.role === "RESIDENT" ? hierarchyEscape(apartmentChain(user.apartmentId)) : user.role === "TOWER_REPRESENTATIVE" ? hierarchyEscape(hierarchyState.towers.find((tower) => tower.id === user.towerId)?.name || "Unassigned") : "—"}</td><td><button class="btn btn-outline btn-sm" onclick="editManagedUser('${user.id}')">Edit</button> <button class="btn btn-outline btn-sm" onclick="deleteManagedUser('${user.id}')">Delete</button></td></tr>`).join("") : '<tr><td colspan="5">No users found.</td></tr>'}</tbody></table></div></div></div><div class="grid-2"><section class="card"><div class="card-header"><h3 class="card-title">Resident → Apartment</h3></div><div class="card-content"><form id="residentAssociationForm"><select class="form-select" name="userId" required>${options(residents, (user) => `${user.name} (${user.email})`)}</select><select class="form-select" name="apartmentId" required>${options(hierarchyState.apartments, (apartment) => apartmentChain(apartment.id))}</select><button class="btn btn-primary" type="submit">Associate Resident</button></form></div></section><section class="card"><div class="card-header"><h3 class="card-title">Tower Representative → Tower</h3></div><div class="card-content"><form id="representativeAssociationForm"><select class="form-select" name="userId" required>${options(representatives, (user) => `${user.name} (${user.email})`)}</select><select class="form-select" name="towerId" required>${options(hierarchyState.towers, (tower) => `${tower.name} (${tower.code})`)}</select><button class="btn btn-primary" type="submit">Associate Representative</button></form></div></section></div>`;
  document.getElementById("createManagedUserForm").onsubmit = createManagedUser;
  document.getElementById("residentAssociationForm").onsubmit = (event) => associateUser(event, "resident-apartment", "apartmentId");
  document.getElementById("representativeAssociationForm").onsubmit = (event) => associateUser(event, "representative-tower", "towerId");
  document.querySelector('#createManagedUserForm option[value="COMMUNITY_ADMIN"]')?.remove();
}

async function refreshUserManagement() { await Promise.all([loadManagedUsers(), loadHierarchyData()]); renderUserManagement(); }
async function createManagedUser(event) {
  event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); if (!data.phone) delete data.phone;
  try { await window.UrbanityApi.apiRequest("/users", { method: "POST", body: data }); form.reset(); await refreshUserManagement(); showAdminToast("User created successfully.", "success"); } catch (error) { showAdminToast(error.message || "Unable to create user.", "error"); }
}
async function editManagedUser(id) {
  const user = userManagementState.users.find((item) => item.id === id); if (!user) return;
  const name = window.prompt("Update name", user.name); if (name === null || !name.trim()) return;
  const email = window.prompt("Update email", user.email); if (email === null || !email.trim()) return;
  const phone = window.prompt("Update phone (optional)", user.phone || ""); if (phone === null) return;
  try { await window.UrbanityApi.apiRequest(`/users/${id}`, { method: "PATCH", body: { name: name.trim(), email: email.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) } }); await Promise.all([loadManagedUsers(), loadHierarchyData()]); showUsersWorkspace(); showAdminToast("User updated successfully.", "success"); } catch (error) { showAdminToast(error.message || "Unable to update user.", "error"); }
}
async function deleteManagedUser(id) {
  if (!window.confirm("Delete this user permanently?")) return;
  try { await window.UrbanityApi.apiRequest(`/users/${id}`, { method: "DELETE" }); await Promise.all([loadManagedUsers(), loadHierarchyData()]); showUsersWorkspace(); showAdminToast("User deleted successfully.", "success"); } catch (error) { showAdminToast(error.message || "Unable to delete user.", "error"); }
}
async function associateUser(event, associationPath, relationshipField) {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); if (!data.userId || !data[relationshipField]) return;
  try { await window.UrbanityApi.apiRequest(`/users/${data.userId}/${associationPath}`, { method: "PATCH", body: { [relationshipField]: data[relationshipField] } }); await refreshUserManagement(); showAdminToast("Hierarchy association updated.", "success"); } catch (error) { showAdminToast(error.message || "Unable to update association.", "error"); }
}

function workforceLabel(value) { return String(value || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
async function loadManagedWorkers() { const response = await adminApiRequest("/workforce/workers"); workforceManagementState.workers = response.data || []; }
function renderWorkforceManagement() {
  const container = document.getElementById("tab-roles-tab");
  if (!container) return;
  const profiledUserIds = new Set(workforceManagementState.workers.map((worker) => worker.userId));
  const accounts = userManagementState.users.filter((user) => user.role === "MAINTENANCE_WORKER" && !profiledUserIds.has(user.id));
  const userName = (id) => { const user = userManagementState.users.find((entry) => entry.id === id); return user ? `${user.name} (${user.email})` : "Maintenance worker account"; };
  const options = (values) => values.map((value) => `<option value="${value}">${hierarchyEscape(workforceLabel(value))}</option>`).join("");
  container.innerHTML = `<div class="card"><div class="card-header"><h3 class="card-title">Shared Maintenance Workforce</h3></div><div class="card-content"><p style="margin-bottom:16px;">Worker profiles are shared across the entire community and are never permanently assigned to a tower.</p><form id="createWorkerProfileForm" class="grid-2"><select class="form-select" name="userId" required><option value="">Select maintenance worker account</option>${accounts.map((user) => `<option value="${user.id}">${hierarchyEscape(`${user.name} (${user.email})`)}</option>`).join("")}</select><select class="form-select" name="specialization" required><option value="">Select specialization</option>${options(WORKER_SPECIALIZATIONS)}</select><select class="form-select" name="status">${options(ADMIN_MANAGED_WORKER_STATUSES)}</select><button class="btn btn-primary" type="submit">Create Worker Profile</button></form>${accounts.length ? "" : "<p style=\"margin-top:12px;\">No maintenance worker accounts available.</p>"}</div></div><div class="card"><div class="card-content"><div style="overflow:auto;"><table><thead><tr><th>Maintenance Worker</th><th>Specialization</th><th>Status</th><th>Rating</th><th>Completed Work</th><th>Actions</th></tr></thead><tbody>${workforceManagementState.workers.length ? workforceManagementState.workers.map((worker) => `<tr><td>${hierarchyEscape(userName(worker.userId))}</td><td>${hierarchyEscape(workforceLabel(worker.specialization))}</td><td>${hierarchyEscape(workforceLabel(worker.status))}</td><td>${worker.rating}</td><td>${worker.completedWorkCount}</td><td><button class="btn btn-outline btn-sm" onclick="viewManagedWorker('${worker.id}')">Details</button> <button class="btn btn-outline btn-sm" onclick="editManagedWorker('${worker.id}')">Edit</button> <button class="btn btn-outline btn-sm" onclick="deactivateManagedWorker('${worker.id}')">Deactivate</button></td></tr>`).join("") : '<tr><td colspan="6">No maintenance workers found.</td></tr>'}</tbody></table></div></div></div>`;
  document.getElementById("createWorkerProfileForm").onsubmit = createManagedWorker;
}
async function refreshWorkforceManagement() { await Promise.all([loadManagedWorkers(), loadManagedUsers()]); renderWorkforceManagement(); }
async function createManagedWorker(event) { event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); try { await window.UrbanityApi.apiRequest("/workforce/workers", { method: "POST", body: data }); form.reset(); await refreshWorkforceManagement(); showAdminToast("Worker profile created.", "success"); } catch (error) { showAdminToast(error.message || "Unable to create worker profile.", "error"); } }
async function viewManagedWorker(id) { try { const worker = (await window.UrbanityApi.apiRequest(`/workforce/workers/${id}`)).data; window.alert(`Specialization: ${workforceLabel(worker.specialization)}\nStatus: ${workforceLabel(worker.status)}\nRating: ${worker.rating}\nCompleted work: ${worker.completedWorkCount}\nWork history: ${(worker.workHistory || []).join(", ") || "No completed work history found."}`); } catch (error) { showAdminToast(error.message || "Unable to load worker details.", "error"); } }
async function editManagedWorker(id) { const worker = workforceManagementState.workers.find((entry) => entry.id === id); if (!worker) return; const specialization = window.prompt(`Specialization (${WORKER_SPECIALIZATIONS.join(", ")})`, worker.specialization); if (specialization === null || !WORKER_SPECIALIZATIONS.includes(specialization.trim().toUpperCase())) return; const status = window.prompt(`Status (${ADMIN_MANAGED_WORKER_STATUSES.join(", ")})`, worker.status); if (status === null || !ADMIN_MANAGED_WORKER_STATUSES.includes(status.trim().toUpperCase())) return; try { await window.UrbanityApi.apiRequest(`/workforce/workers/${id}`, { method: "PATCH", body: { specialization: specialization.trim().toUpperCase(), status: status.trim().toUpperCase() } }); await refreshWorkforceManagement(); showAdminToast("Worker profile updated.", "success"); } catch (error) { showAdminToast(error.message || "Unable to update worker profile.", "error"); } }
async function deactivateManagedWorker(id) { if (!window.confirm("Deactivate this worker profile? The profile and history will be retained.")) return; try { await window.UrbanityApi.apiRequest(`/workforce/workers/${id}`, { method: "DELETE" }); await Promise.all([loadManagedWorkers(), loadManagedUsers()]); showUsersWorkspace(); showAdminToast("Worker profile deactivated.", "success"); } catch (error) { showAdminToast(error.message || "Unable to deactivate worker profile.", "error"); } }

function complaintLabel(value) { return String(value || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function complaintLocation(complaint) {
  const apartment = hierarchyState.apartments.find((item) => item.id === complaint.apartmentId);
  const floor = apartment && hierarchyState.floors.find((item) => item.id === apartment.floorId);
  const tower = hierarchyState.towers.find((item) => item.id === complaint.towerId) || (floor && hierarchyState.towers.find((item) => item.id === floor.towerId));
  const community = hierarchyState.communities.find((item) => item.id === complaint.communityId) || (tower && hierarchyState.communities.find((item) => item.id === tower.communityId));
  return [apartment?.label || apartment?.apartmentNumber, floor?.label, tower?.name, community?.name].filter(Boolean).join(" · ") || "Location unavailable";
}
async function loadManagedComplaints() { const response = await adminApiRequest("/complaints"); complaintManagementState.complaints = response.data || []; complaintManagementState.loaded = true; }
function renderComplaintManagement() {
  const page = document.getElementById("page-system-issues"); if (!page) return;
  const all = complaintManagementState.complaints;
  const filtered = all.filter((complaint) => (!complaintManagementState.filter.type || complaint.type === complaintManagementState.filter.type) && (!complaintManagementState.filter.status || complaint.status === complaintManagementState.filter.status) && (!complaintManagementState.filter.workType || complaint.requiredWorkType === complaintManagementState.filter.workType));
  const option = (values, selected, placeholder) => `<option value="">${placeholder}</option>${[...new Set(values)].map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${hierarchyEscape(complaintLabel(value))}</option>`).join("")}`;
  page.innerHTML = `<div class="page-header-with-action"><div><h1 class="page-title">Community Complaints</h1><p class="page-description">Read-only global complaint view from the authenticated backend.</p></div></div><div class="card"><div class="card-content"><div class="grid-3" style="margin-bottom:16px;"><select id="complaintTypeFilter" class="form-select">${option(all.map((item) => item.type), complaintManagementState.filter.type, "All complaint types")}</select><select id="complaintStatusFilter" class="form-select">${option(all.map((item) => item.status), complaintManagementState.filter.status, "All statuses")}</select><select id="complaintWorkTypeFilter" class="form-select">${option(all.map((item) => item.requiredWorkType), complaintManagementState.filter.workType, "All work types")}</select></div><div style="overflow:auto;"><table><thead><tr><th>Complaint</th><th>Type</th><th>Work Type</th><th>Status</th><th>Location</th><th>Responsible Authority</th><th>Assigned Worker</th><th>Created</th></tr></thead><tbody>${filtered.length ? filtered.map((complaint) => `<tr><td><button class="btn-link managed-complaint" data-id="${complaint.id}">${hierarchyEscape(complaint.title)}</button></td><td>${hierarchyEscape(complaintLabel(complaint.type))}</td><td>${hierarchyEscape(complaintLabel(complaint.requiredWorkType))}</td><td>${hierarchyEscape(complaintLabel(complaint.status))}</td><td>${hierarchyEscape(complaintLocation(complaint))}</td><td>${hierarchyEscape(complaint.responsibleUserName || complaintLabel(complaint.responsibleRole))}</td><td>${hierarchyEscape(complaint.assignedWorkerId || "Unassigned")}</td><td>${hierarchyEscape(new Date(complaint.createdAt).toLocaleString())}</td></tr>`).join("") : '<tr><td colspan="8">No complaints found.</td></tr>'}</tbody></table></div></div></div>`;
  ["type", "status", "workType"].forEach((key) => document.getElementById(`complaint${key[0].toUpperCase()}${key.slice(1)}Filter`).onchange = (event) => { complaintManagementState.filter[key] = event.target.value; renderComplaintManagement(); });
  document.querySelectorAll(".managed-complaint").forEach((button) => { button.onclick = () => viewManagedComplaint(button.dataset.id); });
  const complaintTitle = page.querySelector(".page-title");
  const complaintDescription = page.querySelector(".page-description");
  if (complaintTitle) complaintTitle.textContent = "Complaint Management";
  if (complaintDescription) complaintDescription.textContent = "Review, assign eligible workers, and close reviewed complaints for your community.";
}
function formatAttachmentSize(size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes < 0) return "Size unavailable";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function closeManagedAttachmentPreview() {
  if (activeManagedAttachmentPreview) {
    const blobUrl = activeManagedAttachmentPreview.dataset.blobUrl;
    if (blobUrl) {
      managedAttachmentBlobUrls.delete(blobUrl);
      URL.revokeObjectURL(blobUrl);
    }
    activeManagedAttachmentPreview.remove();
  }
  activeManagedAttachmentPreview = null;
}

function revokeManagedAttachmentBlobUrls() {
  managedAttachmentBlobUrls.forEach((url) => URL.revokeObjectURL(url));
  managedAttachmentBlobUrls.clear();
}

function closeManagedComplaintModal() {
  closeManagedAttachmentPreview();
  revokeManagedAttachmentBlobUrls();
  if (activeManagedComplaintModal) activeManagedComplaintModal.remove();
  activeManagedComplaintModal = null;
}

function attachmentIsPreviewable(attachment) {
  return ["image/jpeg", "image/png", "image/webp"].includes(String(attachment.mimeType || "").toLowerCase());
}

function managedWorkerName(worker) {
  const user = userManagementState.users.find((item) => item.id === worker.userId);
  return user?.name || `Maintenance worker profile ${worker.id}`;
}

function renderManagedAssignmentSection(complaint) {
  if (complaint.assignedWorkerId) {
    const assignedWorker = workforceManagementState.workers.find((worker) => worker.id === complaint.assignedWorkerId);
    return `<h4>Maintenance Worker Assignment</h4><p>Worker already assigned: <b>${hierarchyEscape(assignedWorker ? managedWorkerName(assignedWorker) : complaint.assignedWorkerId)}</b></p>`;
  }
  if (complaint.status !== "UNDER_REVIEW") {
    return `<h4>Maintenance Worker Assignment</h4><p>Assignment is available after the complaint is under review.</p>`;
  }
  return `<h4>Eligible Maintenance Workers</h4><p><b>Required Work Type:</b> ${hierarchyEscape(complaintLabel(complaint.requiredWorkType))}</p><div id="managedAssignmentState">Loading eligible maintenance workers...</div>`;
}

function managedAuthorityRatingStars() {
  return `<div class="authority-star-rating" role="radiogroup" aria-label="Work quality rating" onmouseleave="clearManagedAuthorityRatingHover()">${[1, 2, 3, 4, 5].map((rating) => `<input type="radio" id="managed-authority-rating-${rating}" name="managedAuthorityRating" value="${rating}" onchange="setManagedAuthorityRating(${rating})"><label for="managed-authority-rating-${rating}" class="authority-star" data-managed-authority-star="${rating}" title="${rating} out of 5" aria-label="${rating} out of 5" onmouseenter="setManagedAuthorityRatingHover(${rating})">★</label>`).join("")}</div>`;
}

function renderManagedLifecycleSection(complaint) {
  if (complaint.status === "SUBMITTED") return '<h4>Complaint Lifecycle</h4><p>Review this complaint before assigning a maintenance worker.</p><button class="btn btn-primary" type="button" data-lifecycle-status="UNDER_REVIEW">Start Review</button>';
  if (complaint.status === "PENDING_VERIFICATION" && complaint.responsibleRole === "COMMUNITY_ADMIN") return `<h4>Resolution Verification</h4><p>Review the worker's proof of work, then rate the completed work.</p><form id="managedVerificationForm" class="managed-verification-form"><label>Rate worker quality</label>${managedAuthorityRatingStars()}<button class="btn btn-primary" type="submit">Verify resolution</button></form>`;
  if (complaint.status === "REVIEWED") return '<h4>Complaint Lifecycle</h4><p>The resident review is complete.</p><button class="btn btn-primary" type="button" data-lifecycle-status="CLOSED">Close Complaint</button>';
  if (complaint.status === "RESOLVED") return '<h4>Complaint Lifecycle</h4><p>Awaiting Resident Review.</p>';
  return '<h4>Complaint Lifecycle</h4><p>No Admin lifecycle action is available for this status.</p>';
}

function noManagedReviewMessage(complaint) {
  if (complaint.status === "RESOLVED") return "Awaiting resident review.";
  if (["REVIEWED", "CLOSED"].includes(complaint.status)) return "No resident review submitted yet.";
  return "Review not available yet.";
}

function renderManagedReview(review) {
  return `<div id="managedReviewState" class="card" style="margin:0;"><div class="card-content" style="padding:12px;"><p><b>Overall:</b> ${hierarchyEscape(review.rating)} / 5</p><p><b>Speed:</b> ${hierarchyEscape(review.speedRating)} / 5 · <b>Quality:</b> ${hierarchyEscape(review.qualityRating)} / 5 · <b>Communication:</b> ${hierarchyEscape(review.communicationRating)} / 5</p>${review.feedback ? `<p><b>Feedback:</b><br>${hierarchyEscape(review.feedback)}</p>` : "<p>No written feedback provided.</p>"}<p><b>Reviewed at:</b> ${hierarchyEscape(new Date(review.createdAt).toLocaleString())}</p></div></div>`;
}

async function loadManagedReview(overlay, complaint, requestId) {
  try {
    const response = await window.UrbanityApi.apiRequest(`/complaints/${complaint.id}/review`);
    if (activeManagedComplaintModal !== overlay || !overlay.isConnected || managedReviewState.requestId !== requestId) return;
    const reviewState = overlay.querySelector("#managedReviewState");
    if (reviewState) reviewState.outerHTML = renderManagedReview(response.data);
  } catch (error) {
    if (activeManagedComplaintModal !== overlay || !overlay.isConnected || managedReviewState.requestId !== requestId) return;
    const reviewState = overlay.querySelector("#managedReviewState");
    if (!reviewState) return;
    reviewState.textContent = error?.status === 400 ? noManagedReviewMessage(complaint) : "Unable to load resident review.";
  }
}

async function updateManagedComplaintLifecycle(button, overlay, complaint, nextStatus, requestId) {
  if (managedLifecycleState.updating || activeManagedComplaintModal !== overlay || managedLifecycleState.requestId !== requestId) return;
  const actionLabel = nextStatus === "UNDER_REVIEW" ? "start the review" : "close this complaint";
  const confirmation = await showAdminDialog({ title: nextStatus === "UNDER_REVIEW" ? "Start Complaint Review" : "Close Complaint", message: `Are you sure you want to ${actionLabel}?`, confirmText: nextStatus === "UNDER_REVIEW" ? "Start Review" : "Close", cancelText: "Cancel" });
  if (!confirmation?.confirmed || managedLifecycleState.updating || activeManagedComplaintModal !== overlay || managedLifecycleState.requestId !== requestId) return;
  managedLifecycleState.updating = true;
  button.disabled = true;
  button.textContent = "Updating...";
  try {
    await window.UrbanityApi.apiRequest(`/complaints/${complaint.id}/status`, { method: "PATCH", body: { status: nextStatus } });
    showAdminToast(nextStatus === "UNDER_REVIEW" ? "Complaint marked under review." : "Complaint closed successfully.", "success");
    await loadManagedComplaints();
    renderComplaintManagement();
    if (activeManagedComplaintModal === overlay && overlay.isConnected) await viewManagedComplaint(complaint.id);
  } catch (error) {
    showAdminToast(error.message || "Unable to update complaint status.", "error");
    if (activeManagedComplaintModal === overlay && overlay.isConnected) { button.disabled = false; button.textContent = nextStatus === "UNDER_REVIEW" ? "Start Review" : "Close Complaint"; }
  } finally { managedLifecycleState.updating = false; }
}

async function verifyManagedResolution(event, overlay, complaint, requestId) {
  event.preventDefault();
  if (activeManagedComplaintModal !== overlay || managedLifecycleState.requestId !== requestId) return;
  const authorityRating = Number(overlay.querySelector('input[name="managedAuthorityRating"]:checked')?.value);
  if (!Number.isInteger(authorityRating) || authorityRating < 1 || authorityRating > 5) return showAdminToast("Select a work-quality rating from 1 to 5.", "error");
  const submitButton = event.currentTarget.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    await window.UrbanityApi.apiRequest(`/complaints/${complaint.id}/verify-resolution`, { method: "PATCH", body: { authorityRating } });
    showAdminToast("Resolution verified. The resident can now submit feedback.", "success");
    await Promise.all([loadManagedComplaints(), loadManagedWorkers()]);
    renderComplaintManagement();
    if (activeManagedComplaintModal === overlay && overlay.isConnected) await viewManagedComplaint(complaint.id);
  } catch (error) {
    showAdminToast(error.message || "Unable to verify the resolution.", "error");
    if (activeManagedComplaintModal === overlay && overlay.isConnected) submitButton.disabled = false;
  }
}

function setManagedAuthorityRating(value) {
  document.querySelectorAll("[data-managed-authority-star]").forEach((star) => star.classList.toggle("selected", Number(star.dataset.managedAuthorityStar) <= value));
}

function setManagedAuthorityRatingHover(value) {
  document.querySelectorAll("[data-managed-authority-star]").forEach((star) => star.classList.toggle("hover-selected", Number(star.dataset.managedAuthorityStar) <= value));
}

function clearManagedAuthorityRatingHover() {
  document.querySelectorAll("[data-managed-authority-star]").forEach((star) => star.classList.remove("hover-selected"));
}

function renderEligibleManagedWorkers(workers) {
  if (!workers.length) return '<p id="managedAssignmentState">No eligible maintenance workers are currently available.</p>';
  return `<form id="managedAssignmentForm"><div id="managedAssignmentState" style="overflow:auto;"><table><thead><tr><th>Select</th><th>Maintenance Worker</th><th>Specialization</th><th>Status</th><th>Rating</th><th>Completed Works</th></tr></thead><tbody>${workers.map((worker) => `<tr><td><input type="radio" name="workerId" value="${hierarchyEscape(worker.id)}" required></td><td>${hierarchyEscape(managedWorkerName(worker))}<br><small>${hierarchyEscape(worker.id)}</small></td><td>${hierarchyEscape(complaintLabel(worker.specialization))}</td><td>${hierarchyEscape(complaintLabel(worker.status))}</td><td>${hierarchyEscape(worker.rating)}</td><td>${hierarchyEscape(worker.completedWorkCount)}</td></tr>`).join("")}</tbody></table></div><button class="btn btn-primary" type="submit" style="margin-top:12px;">Assign selected worker</button></form>`;
}

async function loadEligibleManagedWorkers(overlay, complaint, requestId) {
  try {
    const response = await window.UrbanityApi.apiRequest(`/complaints/${complaint.id}/eligible-workers`);
    if (activeManagedComplaintModal !== overlay || !overlay.isConnected || managedAssignmentState.requestId !== requestId) return;
    const workers = response.data || [];
    const assignmentState = overlay.querySelector("#managedAssignmentState");
    if (assignmentState) assignmentState.outerHTML = renderEligibleManagedWorkers(workers);
    const form = overlay.querySelector("#managedAssignmentForm");
    if (form) form.onsubmit = (event) => assignManagedWorker(event, overlay, complaint, workers, requestId);
  } catch (_error) {
    if (activeManagedComplaintModal === overlay && overlay.isConnected && managedAssignmentState.requestId === requestId) {
      const assignmentState = overlay.querySelector("#managedAssignmentState");
      if (assignmentState) assignmentState.textContent = "Unable to load eligible maintenance workers.";
    }
  }
}

async function assignManagedWorker(event, overlay, complaint, workers, requestId) {
  event.preventDefault();
  if (managedAssignmentState.assigning || activeManagedComplaintModal !== overlay || managedAssignmentState.requestId !== requestId) return;
  const workerId = new FormData(event.currentTarget).get("workerId");
  const worker = workers.find((item) => item.id === workerId);
  if (!worker) return;
  const confirmation = await showAdminDialog({ title: "Assign Maintenance Worker", message: `Assign this complaint to ${managedWorkerName(worker)}?\nSpecialization: ${complaintLabel(worker.specialization)}`, confirmText: "Assign", cancelText: "Cancel" });
  if (!confirmation?.confirmed || managedAssignmentState.assigning || activeManagedComplaintModal !== overlay || managedAssignmentState.requestId !== requestId) return;
  managedAssignmentState.assigning = true;
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Assigning worker..."; }
  try {
    await window.UrbanityApi.apiRequest(`/complaints/${complaint.id}/assign`, { method: "POST", body: { workerId: worker.id } });
    showAdminToast("Maintenance worker assigned successfully.", "success");
    await Promise.all([loadManagedComplaints(), loadManagedWorkers()]);
    renderComplaintManagement();
    if (activeManagedComplaintModal === overlay && overlay.isConnected) await viewManagedComplaint(complaint.id);
  } catch (error) {
    showAdminToast(error.message || "Unable to assign maintenance worker.", "error");
    if (activeManagedComplaintModal === overlay && overlay.isConnected && submitButton) { submitButton.disabled = false; submitButton.textContent = "Assign selected worker"; }
  } finally { managedAssignmentState.assigning = false; }
}

function renderManagedAttachments(attachments) {
  if (!attachments.length) return '<p id="managedAttachmentState">No attachments found.</p>';
  return `<div id="managedAttachmentState" style="display:grid; gap:10px;">${attachments.map((attachment) => `<div class="card" style="margin:0;"><div class="card-content" style="padding:12px;"><div class="flex items-center justify-between gap-3"><div><b>${hierarchyEscape(attachment.originalName || "Attachment")}</b><br><small>${hierarchyEscape(attachment.mimeType || "Content type unavailable")} · ${hierarchyEscape(formatAttachmentSize(attachment.size))}<br>Uploaded ${hierarchyEscape(attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleString() : "date unavailable")}${attachment.uploadedByRole ? ` by ${hierarchyEscape(complaintLabel(attachment.uploadedByRole))}` : ""}</small></div>${attachmentIsPreviewable(attachment) ? `<button class="btn btn-outline btn-sm" data-view-attachment="${hierarchyEscape(attachment.id)}">View</button>` : ""}</div></div></div>`).join("")}</div>`;
}

async function previewManagedAttachment(complaintId, attachment) {
  if (!attachmentIsPreviewable(attachment)) return;
  try {
    const blob = await window.UrbanityApi.apiRequest(`/complaints/${complaintId}/attachments/${attachment.id}`, { responseType: "blob" });
    if (!blob || !String(blob.type || "").toLowerCase().startsWith("image/")) throw new Error("The attachment is not an image that can be previewed.");
    closeManagedAttachmentPreview();
    const blobUrl = URL.createObjectURL(blob);
    managedAttachmentBlobUrls.add(blobUrl);
    const preview = document.createElement("div");
    preview.className = "modal-overlay active";
    preview.dataset.blobUrl = blobUrl;
    preview.innerHTML = `<div class="modal"><div class="modal-header"><h3 class="modal-title">${hierarchyEscape(attachment.originalName || "Attachment preview")}</h3><button class="modal-close" data-close>×</button></div><div class="modal-body"><img src="${blobUrl}" alt="${hierarchyEscape(attachment.originalName || "Complaint attachment")}" style="display:block; width:100%; max-height:70vh; object-fit:contain;"></div></div>`;
    const closePreview = () => { managedAttachmentBlobUrls.delete(blobUrl); URL.revokeObjectURL(blobUrl); if (activeManagedAttachmentPreview === preview) activeManagedAttachmentPreview = null; preview.remove(); };
    preview.addEventListener("click", (event) => { if (event.target === preview || event.target.closest("[data-close]")) closePreview(); });
    activeManagedAttachmentPreview = preview;
    document.body.appendChild(preview);
  } catch (error) { showAdminToast(error.message || "Unable to retrieve this attachment.", "error"); }
}

async function viewManagedComplaint(id) {
  closeManagedComplaintModal();
  managedAssignmentState.assigning = false;
  managedAssignmentState.requestId += 1;
  managedLifecycleState.updating = false;
  managedLifecycleState.requestId += 1;
  managedReviewState.requestId += 1;
  const assignmentRequestId = managedAssignmentState.requestId;
  const lifecycleRequestId = managedLifecycleState.requestId;
  const reviewRequestId = managedReviewState.requestId;
  try {
    const complaint = (await window.UrbanityApi.apiRequest(`/complaints/${id}`)).data;
    const history = (complaint.statusHistory || []).map((entry) => `<li>${hierarchyEscape(complaintLabel(entry.status))} · ${hierarchyEscape(new Date(entry.changedAt).toLocaleString())} · ${hierarchyEscape(complaintLabel(entry.changedByRole))}</li>`).join("") || "<li>No status history available.</li>";
    const overlay = document.createElement("div"); overlay.className = "modal-overlay active";
    overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3 class="modal-title">${hierarchyEscape(complaint.title)}</h3><button class="modal-close" data-close>×</button></div><div class="modal-body"><p>${hierarchyEscape(complaint.description)}</p><p><b>Type:</b> ${hierarchyEscape(complaintLabel(complaint.type))}<br><b>Required work:</b> ${hierarchyEscape(complaintLabel(complaint.requiredWorkType))}<br><b>Status:</b> ${hierarchyEscape(complaintLabel(complaint.status))}<br><b>Location:</b> ${hierarchyEscape(complaintLocation(complaint))}<br><b>Responsible authority:</b> ${hierarchyEscape(complaint.responsibleUserName || complaintLabel(complaint.responsibleRole))}<br><b>Assigned worker:</b> ${hierarchyEscape(complaint.assignedWorkerId || "Unassigned")}<br><b>Created:</b> ${hierarchyEscape(new Date(complaint.createdAt).toLocaleString())}<br><b>Updated:</b> ${hierarchyEscape(new Date(complaint.updatedAt).toLocaleString())}</p><h4>Status History</h4><ul>${history}</ul>${renderManagedLifecycleSection(complaint)}${renderManagedAssignmentSection(complaint)}<h4>Resident Review</h4><p id="managedReviewState">Loading resident review...</p><h4>Attachments</h4><p id="managedAttachmentState">Loading attachments...</p></div></div>`;
    overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-close]")) closeManagedComplaintModal(); });
    activeManagedComplaintModal = overlay;
    document.body.appendChild(overlay);
    if (complaint.resolutionProof) {
      overlay.querySelector(".modal-body").insertAdjacentHTML("beforeend", `<section><h4>Resolution Proof</h4><p><b>Problem identified:</b> ${hierarchyEscape(complaint.resolutionProof.problemFound)}</p><p><b>Resolution:</b> ${hierarchyEscape(complaint.resolutionProof.resolutionSummary)}</p>${complaint.resolutionVerification ? `<p><b>Authority rating:</b> ${hierarchyEscape(complaint.resolutionVerification.authorityRating)} / 5</p>` : ""}</section>`);
    }
    overlay.querySelectorAll("[data-lifecycle-status]").forEach((button) => { button.onclick = () => updateManagedComplaintLifecycle(button, overlay, complaint, button.dataset.lifecycleStatus, lifecycleRequestId); });
    overlay.querySelector("#managedVerificationForm")?.addEventListener("submit", (event) => verifyManagedResolution(event, overlay, complaint, lifecycleRequestId));
    if (!complaint.assignedWorkerId && complaint.status === "UNDER_REVIEW") loadEligibleManagedWorkers(overlay, complaint, assignmentRequestId);
    loadManagedReview(overlay, complaint, reviewRequestId);
    try {
      const response = await window.UrbanityApi.apiRequest(`/complaints/${complaint.id}/attachments`);
      if (activeManagedComplaintModal !== overlay || !overlay.isConnected) return;
      const attachments = response.data || [];
      const attachmentState = overlay.querySelector("#managedAttachmentState");
      if (attachmentState) attachmentState.outerHTML = renderManagedAttachments(attachments);
      overlay.querySelectorAll("[data-view-attachment]").forEach((button) => {
        const attachment = attachments.find((item) => item.id === button.dataset.viewAttachment);
        button.onclick = () => { if (attachment) previewManagedAttachment(complaint.id, attachment); };
      });
    } catch (_error) {
      if (activeManagedComplaintModal === overlay && overlay.isConnected) {
        const attachmentState = overlay.querySelector("#managedAttachmentState");
        if (attachmentState) attachmentState.textContent = "Unable to load attachments.";
      }
    }
  } catch (error) { showAdminToast(error.message || "Unable to load complaint details.", "error"); }
}

const adminIssueFilters = {
  search: "",
  status: "all",
  severity: "all",
};

const ADMIN_TECHNICAL_SYSTEM_ISSUES = [
  {
    id: "ISS-001",
    title: "API Gateway Rate Limit Spikes",
    description: "Traffic bursts are triggering 429 responses for complaint submission endpoints.",
    location: "Urbanity Cloud",
    status: "in-progress",
    category: "Infrastructure",
    department: "System",
    date: "April 1, 2026",
    reportedBy: "System Monitor",
  },
  {
    id: "ISS-002",
    title: "Notification Queue Delay",
    description: "Email and SMS notifications are delayed by up to 12 minutes during peak load.",
    location: "Messaging Service",
    status: "pending",
    category: "Infrastructure",
    department: "System",
    date: "April 1, 2026",
    reportedBy: "Alert Engine",
  },
  {
    id: "ISS-003",
    title: "File Storage Degradation",
    description: "Complaint media uploads intermittently fail due to elevated object storage latency.",
    location: "Media Storage",
    status: "reopened",
    category: "Infrastructure",
    department: "System",
    date: "March 31, 2026",
    reportedBy: "Storage Health Check",
  },
];

function mapSeverityToCategory(severity) {
  const normalized = String(severity || "").toLowerCase();
  if (normalized === "high") return "Infrastructure";
  if (normalized === "medium") return "Sanitation";
  return "General";
}

function loadTechnicalIssuesState() {
  const stored = localStorage.getItem(ADMIN_TECHNICAL_ISSUES_KEY);
  if (!stored) {
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return;
    }

    ADMIN_TECHNICAL_SYSTEM_ISSUES.splice(0, ADMIN_TECHNICAL_SYSTEM_ISSUES.length);
    parsed.forEach((item) => {
      if (item && item.id && item.title) {
        ADMIN_TECHNICAL_SYSTEM_ISSUES.push(item);
      }
    });
  } catch (error) {
    console.error("Could not parse technical issues state.", error);
  }
}

function saveTechnicalIssuesState() {
  localStorage.setItem(
    ADMIN_TECHNICAL_ISSUES_KEY,
    JSON.stringify(ADMIN_TECHNICAL_SYSTEM_ISSUES),
  );
}

function resetAddSystemIssueForm() {
  const title = document.getElementById("systemIssueTitleInput");
  const description = document.getElementById("systemIssueDescriptionInput");
  const location = document.getElementById("systemIssueLocationInput");
  const status = document.getElementById("systemIssueStatusInput");
  const severity = document.getElementById("systemIssueSeverityInput");

  if (title) title.value = "";
  if (description) description.value = "";
  if (location) location.value = "";
  if (status) status.value = "pending";
  if (severity) severity.value = "high";
}

function nextTechnicalIssueId() {
  const used = ADMIN_TECHNICAL_SYSTEM_ISSUES
    .map((item) => Number(String(item.id || "").replace("ISS-", "")))
    .filter((value) => Number.isFinite(value));
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `ISS-${String(next).padStart(3, "0")}`;
}

function handleCreateSystemIssue() {
  if (!hasPermission("system-issues", "create")) {
    showAdminToast("You do not have permission to create system issues.", "error");
    return;
  }

  const title = (document.getElementById("systemIssueTitleInput")?.value || "").trim();
  const description = (document.getElementById("systemIssueDescriptionInput")?.value || "").trim();
  const location = (document.getElementById("systemIssueLocationInput")?.value || "").trim();
  const status = document.getElementById("systemIssueStatusInput")?.value || "pending";
  const severity = document.getElementById("systemIssueSeverityInput")?.value || "high";
  const currentUser = getCurrentSessionUser();

  if (!title || title.length < 4) {
    showAdminToast("Issue title should be at least 4 characters.", "error");
    return;
  }

  if (!description || description.length < 10) {
    showAdminToast("Issue description should be at least 10 characters.", "error");
    return;
  }

  if (!location) {
    showAdminToast("Location / service is required.", "error");
    return;
  }

  ADMIN_TECHNICAL_SYSTEM_ISSUES.unshift({
    id: nextTechnicalIssueId(),
    title,
    description,
    location,
    status,
    category: mapSeverityToCategory(severity),
    department: "System",
    date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    reportedBy: currentUser?.name || "Admin",
  });

  saveTechnicalIssuesState();
  resetAddSystemIssueForm();
  closeModal("addSystemIssueModal");
  if (!complaintManagementState.loaded) renderAdminSystemIssues();
  showAdminToast("System issue created successfully.", "success");
}

const adminCrudState = {
  users: [],
  roles: [],
  departments: [],
};

const adminEscalationState = {
  rules: [],
  editingRuleId: null,
};

function syncEscalationRuleModalMode() {
  const titleNode = document.getElementById("addRuleModalTitle");
  const descNode = document.getElementById("addRuleModalDescription");
  const submitNode = document.getElementById("addRuleModalSubmit");
  const isEditing = Boolean(adminEscalationState.editingRuleId);

  if (titleNode) {
    titleNode.textContent = isEditing ? "Edit Escalation Rule" : "Add New Escalation Rule";
  }
  if (descNode) {
    descNode.textContent = isEditing
      ? "Update escalation criteria and response handling."
      : "Configure automatic escalation rules based on issue criteria.";
  }
  if (submitNode) {
    submitNode.textContent = isEditing ? "Update Rule" : "Create Rule";
  }
}

function setEscalationRuleFormValues(rule) {
  document.getElementById("ruleNameInput").value = rule.name || "";
  document.getElementById("ruleTriggerTypeInput").value = rule.triggerType || "Select trigger type";
  document.getElementById("ruleTriggerConditionInput").value = rule.triggerCondition || "";
  document.getElementById("rulePriorityInput").value = rule.priority || "Select priority";
  document.getElementById("ruleNotifyInput").value = rule.notify || "Select notification recipients";
  document.getElementById("ruleTimelineInput").value = rule.timeline || "Select timeline";
  document.getElementById("ruleDepartmentInput").value = rule.department || "Select department";
  document.getElementById("ruleAutoAssignInput").checked = Boolean(rule.autoAssign);
  document.getElementById("ruleEnabledInput").checked = Boolean(rule.enabled);
}

async function handleReadEscalationRule(ruleId) {
  if (!hasPermission("escalated-issues", "read")) {
    showAdminToast("You do not have permission to read escalation rules.", "error");
    return;
  }

  const rule = adminEscalationState.rules.find((entry) => entry.id === ruleId);
  if (!rule) {
    showAdminToast("Escalation rule not found.", "error");
    return;
  }

  const titleNode = document.getElementById("viewRuleTitle");
  const statusNode = document.getElementById("viewRuleStatus");
  const triggerTypeNode = document.getElementById("viewRuleTriggerType");
  const triggerConditionNode = document.getElementById("viewRuleTriggerCondition");
  const priorityNode = document.getElementById("viewRulePriority");
  const notifyNode = document.getElementById("viewRuleNotify");
  const timelineNode = document.getElementById("viewRuleTimeline");
  const departmentNode = document.getElementById("viewRuleDepartment");
  const autoAssignNode = document.getElementById("viewRuleAutoAssign");
  const enabledNode = document.getElementById("viewRuleEnabled");

  if (
    !titleNode ||
    !statusNode ||
    !triggerTypeNode ||
    !triggerConditionNode ||
    !priorityNode ||
    !notifyNode ||
    !timelineNode ||
    !departmentNode ||
    !autoAssignNode ||
    !enabledNode
  ) {
    showAdminToast("Rule details view is unavailable right now.", "error");
    return;
  }

  titleNode.textContent = rule.name;
  statusNode.textContent = rule.enabled ? "Enabled" : "Disabled";
  statusNode.className = `badge ${rule.enabled ? "badge-green" : "badge-orange"}`;
  triggerTypeNode.textContent = rule.triggerType;
  triggerConditionNode.textContent = rule.triggerCondition;
  priorityNode.textContent = rule.priority;
  notifyNode.textContent = rule.notify;
  timelineNode.textContent = rule.timeline;
  departmentNode.textContent = rule.department;
  autoAssignNode.textContent = rule.autoAssign ? "Yes" : "No";
  enabledNode.textContent = rule.enabled ? "Yes" : "No";

  openModal("viewRuleModal");
}

function handleEditEscalationRule(ruleId) {
  if (!hasPermission("escalated-issues", "update")) {
    showAdminToast("You do not have permission to update escalation rules.", "error");
    return;
  }

  const rule = adminEscalationState.rules.find((entry) => entry.id === ruleId);
  if (!rule) {
    showAdminToast("Escalation rule not found.", "error");
    return;
  }

  adminEscalationState.editingRuleId = ruleId;
  syncEscalationRuleModalMode();
  openModal("addRuleModal");
  setEscalationRuleFormValues(rule);
}

async function handleDeleteEscalationRule(ruleId) {
  if (!hasPermission("escalated-issues", "delete")) {
    showAdminToast("You do not have permission to delete escalation rules.", "error");
    return;
  }

  const rule = adminEscalationState.rules.find((entry) => entry.id === ruleId);
  if (!rule) {
    showAdminToast("Escalation rule not found.", "error");
    return;
  }

  const result = await showAdminDialog({
    title: "Delete Escalation Rule",
    message: `Delete rule \"${rule.name}\"? This action cannot be undone.`,
    confirmText: "Delete",
    cancelText: "Cancel",
  });

  if (!result.confirmed) {
    return;
  }

  adminEscalationState.rules = adminEscalationState.rules.filter((entry) => entry.id !== ruleId);
  saveEscalationRulesState();
  renderAdminEscalationRules();
  showAdminToast("Escalation rule deleted.", "success");
}

function getDefaultEscalationRules() {
  return [
    {
      id: "RULE-DEFAULT-1",
      name: "Emergency Civic Issues",
      triggerType: "Issue Category",
      triggerCondition: "Category: Water/Gas/Electric Emergency",
      priority: "P0 - Critical Emergency",
      notify: "Emergency Response Team",
      timeline: "Immediate",
      department: "All Departments",
      autoAssign: true,
      enabled: true,
    },
  ];
}

function loadEscalationRulesState() {
  const stored = localStorage.getItem(ADMIN_ESCALATION_RULES_KEY);
  if (!stored) {
    adminEscalationState.rules = getDefaultEscalationRules();
    saveEscalationRulesState();
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    adminEscalationState.rules = Array.isArray(parsed)
      ? parsed
      : getDefaultEscalationRules();
  } catch (error) {
    console.error("Could not parse escalation rules state.", error);
    adminEscalationState.rules = getDefaultEscalationRules();
    saveEscalationRulesState();
  }
}

function saveEscalationRulesState() {
  localStorage.setItem(
    ADMIN_ESCALATION_RULES_KEY,
    JSON.stringify(adminEscalationState.rules),
  );
}

function renderAdminEscalationRules() {
  const container = document.getElementById("adminEscalationRulesList");
  if (!container) {
    return;
  }

  if (!adminEscalationState.rules.length) {
    container.innerHTML =
      '<div class="card"><div class="card-content" style="padding: 24px;">No escalation rules configured.</div></div>';
    return;
  }

  container.innerHTML = adminEscalationState.rules
    .map(
      (rule) => `
      <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px;">
        <div class="flex items-center justify-between">
          <div style="flex: 1;">
            <div class="flex items-center gap-3 mb-2">
              <h4 style="font-weight: 600; color: #111827;">${rule.name}</h4>
              <span class="badge ${rule.enabled ? "badge-green" : "badge-orange"}">${rule.enabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280; font-size: 14px; display: inline-block; width: 80px;">Trigger:</span>
              <span style="color: #374151; font-size: 14px;">${rule.triggerType}: ${rule.triggerCondition}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280; font-size: 14px; display: inline-block; width: 80px;">Action:</span>
              <span style="color: #374151; font-size: 14px;">Escalate to ${rule.priority}, Notify ${rule.notify}${rule.autoAssign ? ", Auto-assign field worker" : ""}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280; font-size: 14px; display: inline-block; width: 80px;">Timeline:</span>
              <span style="color: #374151; font-size: 14px;">${rule.timeline}</span>
            </div>
            <div>
              <span style="color: #6b7280; font-size: 14px; display: inline-block; width: 80px;">Department:</span>
              <span style="color: #374151; font-size: 14px;">${rule.department}</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-left: 16px;">
            <button class="btn btn-outline btn-sm" data-read-rule="${rule.id}">View</button>
            <button class="btn btn-outline btn-sm" data-edit-rule="${rule.id}">Edit</button>
            <button class="btn btn-outline btn-sm" data-delete-rule="${rule.id}">Delete</button>
          </div>
        </div>
      </div>
    `,
    )
    .join("");
}

function resetAddEscalationRuleForm() {
  const ruleName = document.getElementById("ruleNameInput");
  const triggerType = document.getElementById("ruleTriggerTypeInput");
  const triggerCondition = document.getElementById("ruleTriggerConditionInput");
  const priority = document.getElementById("rulePriorityInput");
  const notify = document.getElementById("ruleNotifyInput");
  const timeline = document.getElementById("ruleTimelineInput");
  const department = document.getElementById("ruleDepartmentInput");
  const autoAssign = document.getElementById("ruleAutoAssignInput");
  const enabled = document.getElementById("ruleEnabledInput");

  if (ruleName) ruleName.value = "";
  if (triggerType) triggerType.selectedIndex = 0;
  if (triggerCondition) triggerCondition.value = "";
  if (priority) priority.selectedIndex = 0;
  if (notify) notify.selectedIndex = 0;
  if (timeline) timeline.selectedIndex = 0;
  if (department) department.selectedIndex = 0;
  if (autoAssign) autoAssign.checked = false;
  if (enabled) enabled.checked = true;
}

function handleAddEscalationRule() {
  const isEditing = Boolean(adminEscalationState.editingRuleId);
  const action = isEditing ? "update" : "create";

  if (!hasPermission("escalated-issues", action)) {
    showAdminToast(
      `You do not have permission to ${isEditing ? "update" : "create"} escalation rules.`,
      "error",
    );
    return;
  }

  const ruleName = (document.getElementById("ruleNameInput")?.value || "").trim();
  const triggerType = document.getElementById("ruleTriggerTypeInput")?.value || "";
  const triggerCondition = (document.getElementById("ruleTriggerConditionInput")?.value || "").trim();
  const priority = document.getElementById("rulePriorityInput")?.value || "";
  const notify = document.getElementById("ruleNotifyInput")?.value || "";
  const timeline = document.getElementById("ruleTimelineInput")?.value || "";
  const department = document.getElementById("ruleDepartmentInput")?.value || "";
  const autoAssign = Boolean(document.getElementById("ruleAutoAssignInput")?.checked);
  const enabled = Boolean(document.getElementById("ruleEnabledInput")?.checked);

  if (!ruleName || ruleName.length < 3) {
    showAdminToast("Rule name should be at least 3 characters.", "error");
    return;
  }

  if (
    triggerType === "Select trigger type" ||
    !triggerCondition ||
    priority === "Select priority" ||
    notify === "Select notification recipients" ||
    timeline === "Select timeline" ||
    department === "Select department"
  ) {
    showAdminToast("Please complete all required escalation rule fields.", "error");
    return;
  }

  if (isEditing) {
    const index = adminEscalationState.rules.findIndex(
      (entry) => entry.id === adminEscalationState.editingRuleId,
    );
    if (index === -1) {
      showAdminToast("Escalation rule not found.", "error");
      return;
    }

    adminEscalationState.rules[index] = {
      ...adminEscalationState.rules[index],
      name: ruleName,
      triggerType,
      triggerCondition,
      priority,
      notify,
      timeline,
      department,
      autoAssign,
      enabled,
    };
  } else {
    adminEscalationState.rules.unshift({
      id: generateItemId("rule"),
      name: ruleName,
      triggerType,
      triggerCondition,
      priority,
      notify,
      timeline,
      department,
      autoAssign,
      enabled,
    });
  }

  saveEscalationRulesState();
  renderAdminEscalationRules();
  closeModal("addRuleModal");
  resetAddEscalationRuleForm();
  showAdminToast(
    isEditing
      ? "Escalation rule updated successfully."
      : "Escalation rule created successfully.",
    "success",
  );
}

const ADMIN_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_PHONE_REGEX = /^(\+91[-\s]?)?[6-9]\d{9}$/;

function loadAdminCrudState() {
  if (window.MockDataAPI) {
    adminCrudState.users = window.MockDataAPI.list("users");
    adminCrudState.roles = window.MockDataAPI.list("roles");
    adminCrudState.departments = window.MockDataAPI.list("departments");
    return;
  }

  const stored = localStorage.getItem(ADMIN_STORE_KEY);
  if (!stored) {
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    adminCrudState.users = Array.isArray(parsed.users) ? parsed.users : [];
    adminCrudState.roles = Array.isArray(parsed.roles) ? parsed.roles : [];
    adminCrudState.departments = Array.isArray(parsed.departments)
      ? parsed.departments
      : [];
  } catch (error) {
    console.error("Could not parse admin CRUD state.", error);
  }
}

function saveAdminCrudState() {
  if (window.MockDataAPI) {
    window.MockDataAPI.setEntity("users", adminCrudState.users);
    window.MockDataAPI.setEntity("roles", adminCrudState.roles);
    window.MockDataAPI.setEntity("departments", adminCrudState.departments);
    return;
  }

  localStorage.setItem(ADMIN_STORE_KEY, JSON.stringify(adminCrudState));
}

function getAdminStoreComplaints() {
  if (!window.MockDataAPI) {
    return [];
  }
  return window.MockDataAPI.list("complaints");
}

function getAdminStoreAssignments() {
  if (!window.MockDataAPI) {
    return [];
  }
  return window.MockDataAPI.list("assignments");
}

function getAdminSystemIssuesData() {
  return [...ADMIN_TECHNICAL_SYSTEM_ISSUES];
}

function getTechnicalSystemIssueById(issueId) {
  return ADMIN_TECHNICAL_SYSTEM_ISSUES.find((item) => item.id === issueId) || null;
}

function escapeAdminHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function openTechnicalIssueViewModal(issue) {
  const existing = document.getElementById("technicalIssueViewOverlay");
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement("div");
  overlay.id = "technicalIssueViewOverlay";
  overlay.className = "modal-overlay active";

  overlay.innerHTML = `
    <div class="modal" style="max-width: 720px;">
      <div class="modal-header" style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
        <div>
          <h3 class="modal-title" style="margin-bottom: 8px;">${escapeAdminHtml(issue.title)}</h3>
          <div class="flex items-center gap-2" style="display:flex; flex-wrap:wrap; gap:8px;">
            <span class="badge badge-gray">${escapeAdminHtml(issue.id)}</span>
            <span class="badge ${getAdminStatusBadgeClass(issue.status)}">${escapeAdminHtml(formatAdminComplaintStatus(issue.status))}</span>
            <span class="badge ${getAdminSeverityBadgeClass(issue.category)}">${escapeAdminHtml(getAdminSeverityLabel(issue.category))}</span>
          </div>
        </div>
        <button type="button" class="btn btn-outline btn-sm" data-close-technical-issue-view="true">Close</button>
      </div>
      <div class="modal-body" style="display:grid; gap:16px;">
        <div style="padding:14px; border:1px solid #e5e7eb; border-radius:10px; background:#f8fafc;">
          <p style="font-size:13px; color:#64748b; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.04em;">Description</p>
          <p style="font-size:14px; color:#111827; line-height:1.6;">${escapeAdminHtml(issue.description || "No description provided.")}</p>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          <div style="padding:12px; border:1px solid #e5e7eb; border-radius:10px;">
            <p style="font-size:12px; color:#6b7280; margin-bottom:4px;">Reported By</p>
            <p style="font-size:14px; color:#111827; font-weight:600;">${escapeAdminHtml(issue.reportedBy || "System")}</p>
          </div>
          <div style="padding:12px; border:1px solid #e5e7eb; border-radius:10px;">
            <p style="font-size:12px; color:#6b7280; margin-bottom:4px;">Department</p>
            <p style="font-size:14px; color:#111827; font-weight:600;">${escapeAdminHtml(issue.department || "System")}</p>
          </div>
          <div style="padding:12px; border:1px solid #e5e7eb; border-radius:10px;">
            <p style="font-size:12px; color:#6b7280; margin-bottom:4px;">Location</p>
            <p style="font-size:14px; color:#111827; font-weight:600;">${escapeAdminHtml(issue.location || "N/A")}</p>
          </div>
          <div style="padding:12px; border:1px solid #e5e7eb; border-radius:10px;">
            <p style="font-size:12px; color:#6b7280; margin-bottom:4px;">Reported On</p>
            <p style="font-size:14px; color:#111827; font-weight:600;">${escapeAdminHtml(issue.date || "N/A")}</p>
          </div>
        </div>
      </div>
    </div>
  `;

  overlay.addEventListener("click", (event) => {
    const closeBtn = event.target.closest("[data-close-technical-issue-view]");
    if (event.target === overlay || closeBtn) {
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
}

async function handleViewTechnicalSystemIssue(issueId) {
  if (!hasPermission("system-issues", "read")) {
    showAdminToast("You do not have permission to read system issues.", "error");
    return;
  }

  const issue = getTechnicalSystemIssueById(issueId);
  if (!issue) {
    showAdminToast("System issue not found.", "error");
    return;
  }

  openTechnicalIssueViewModal(issue);
}

async function handleEditTechnicalSystemIssue(issueId) {
  if (!hasPermission("system-issues", "update")) {
    showAdminToast("You do not have permission to update system issues.", "error");
    return;
  }

  const issue = getTechnicalSystemIssueById(issueId);
  if (!issue) {
    showAdminToast("System issue not found.", "error");
    return;
  }

  const result = await showAdminDialog({
    title: "Edit System Issue Title",
    message: "Update the issue title.",
    confirmText: "Save",
    cancelText: "Cancel",
    inputValue: issue.title,
  });

  const nextTitle = (result.value || "").trim();
  if (!result.confirmed || !nextTitle) {
    return;
  }

  issue.title = nextTitle;
  issue.date = "April 1, 2026";
  saveTechnicalIssuesState();
  renderAdminSystemIssues();
  showAdminToast("System issue updated.", "success");
}

async function handleDeleteTechnicalSystemIssue(issueId) {
  if (!hasPermission("system-issues", "delete")) {
    showAdminToast("You do not have permission to delete system issues.", "error");
    return;
  }

  const issue = getTechnicalSystemIssueById(issueId);
  if (!issue) {
    showAdminToast("System issue not found.", "error");
    return;
  }

  const result = await showAdminDialog({
    title: "Delete System Issue",
    message: `Delete ${issue.id} - ${issue.title}? This action cannot be undone.`,
    confirmText: "Delete",
    cancelText: "Cancel",
  });

  if (!result.confirmed) {
    return;
  }

  const index = ADMIN_TECHNICAL_SYSTEM_ISSUES.findIndex((item) => item.id === issueId);
  if (index >= 0) {
    ADMIN_TECHNICAL_SYSTEM_ISSUES.splice(index, 1);
  }
  saveTechnicalIssuesState();
  renderAdminSystemIssues();
  showAdminToast("System issue deleted.", "success");
}

function formatAdminComplaintStatus(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "in-progress") return "IN-PROGRESS";
  if (normalized === "reopened") return "REOPENED";
  return normalized.toUpperCase() || "PENDING";
}

function getAdminStatusBadgeClass(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "resolved") return "badge-green";
  if (normalized === "pending") return "badge-orange";
  if (normalized === "in-progress") return "badge-blue";
  if (normalized === "reopened" || normalized === "escalated") return "badge-red";
  return "badge-blue";
}

function getAdminSeverityBadgeClass(category) {
  const normalized = (category || "").toLowerCase();
  if (["infrastructure", "roads", "water", "electricity"].includes(normalized)) {
    return "badge-orange";
  }
  if (["sanitation", "parks"].includes(normalized)) {
    return "badge-blue";
  }
  return "badge-green";
}

function getAdminSeverityLabel(category) {
  const normalized = (category || "").toLowerCase();
  if (["infrastructure", "roads", "water", "electricity"].includes(normalized)) {
    return "HIGH";
  }
  if (["sanitation", "parks"].includes(normalized)) {
    return "MEDIUM";
  }
  return "LOW";
}

function normalizeAdminMediaList(mediaList) {
  if (!Array.isArray(mediaList)) {
    return [];
  }

  return mediaList
    .filter((item) => item && item.url)
    .map((item) => ({
      type: item.type || (String(item.url).startsWith("data:video") ? "video" : "image"),
      url: item.url,
      name: item.name || "attachment",
    }));
}

function renderAdminMediaPreview(mediaList) {
  const media = normalizeAdminMediaList(mediaList);
  if (media.length === 0) {
    return "";
  }

  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:10px; margin-top:8px;">
      ${media
        .map((item) => {
          const isVideo = item.type === "video";
          return `
            <a href="${item.url}" target="_blank" rel="noopener" style="display:block; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; text-decoration:none; background:#fff;">
              ${
                isVideo
                  ? `<video src="${item.url}" style="width:100%; height:80px; object-fit:cover; display:block;" muted></video>`
                  : `<img src="${item.url}" alt="${item.name}" style="width:100%; height:80px; object-fit:cover; display:block;" />`
              }
              <span style="display:block; padding:6px 8px; font-size:12px; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</span>
            </a>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAdminSystemIssues() {
  const container = document.getElementById("adminSystemIssuesList");
  if (!container) {
    return;
  }

  const issues = getAdminSystemIssuesData()
    .filter((issue) => {
      const normalizedStatus = (issue.status || "").toLowerCase();
      const normalizedSeverity = getAdminSeverityLabel(issue.category).toLowerCase();

      if (adminIssueFilters.status !== "all" && normalizedStatus !== adminIssueFilters.status) {
        return false;
      }

      if (adminIssueFilters.severity !== "all" && normalizedSeverity !== adminIssueFilters.severity) {
        return false;
      }

      const query = adminIssueFilters.search.trim().toLowerCase();
      if (!query) {
        return true;
      }

      const searchable = [
        issue.id,
        issue.title,
        issue.description,
        issue.location,
        issue.reportedBy,
        issue.reportedByEmail,
        issue.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    })
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
  const assignments = getAdminStoreAssignments();
  const assignmentByComplaintId = new Map(assignments.map((item) => [item.complaintId, item]));

  if (issues.length === 0) {
    container.innerHTML = '<div class="card"><div class="card-content" style="padding: 24px;">No issues found.</div></div>';
    return;
  }

  container.innerHTML = issues
    .map((issue) => {
      const assignment = assignmentByComplaintId.get(issue.id);
      const complaintMedia = normalizeAdminMediaList(issue.media);
      const resolutionMedia = normalizeAdminMediaList(
        issue.resolutionMedia && issue.resolutionMedia.length
          ? issue.resolutionMedia
          : assignment?.proofMedia,
      );

      return `
        <div class="card">
          <div class="card-content" style="padding: 24px;">
            <div class="flex items-start gap-4">
              <div style="padding: 12px; border-radius: 8px; background-color: #fff7ed;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style="flex: 1;">
                <div class="flex items-start justify-between mb-2">
                  <div style="flex: 1;">
                    <div class="flex items-center gap-2 mb-2">
                      <h3 class="font-semibold" style="color: #111827;">${issue.title}</h3>
                      <span class="badge ${getAdminSeverityBadgeClass(issue.category)}" style="text-transform: uppercase; font-size: 11px;">${getAdminSeverityLabel(issue.category)}</span>
                      <span class="badge ${getAdminStatusBadgeClass(issue.status)}" style="text-transform: uppercase; font-size: 11px;">${formatAdminComplaintStatus(issue.status)}</span>
                    </div>
                    <p class="text-sm" style="color: #4b5563; margin-bottom: 12px;">${issue.description || "No description"}</p>
                    <div class="flex items-center gap-6 text-sm" style="color: #6b7280; flex-wrap: wrap;">
                      <span class="font-medium">${issue.id}</span>
                      <span>Assigned: ${assignment?.assignee || "Unassigned"}</span>
                      <span>Reported by: ${issue.reportedBy || "System"}</span>
                      <span>${issue.date || "N/A"}</span>
                      <span>Type: Technical Incident</span>
                    </div>

                    <div class="flex items-center gap-2" style="margin-top: 12px;">
                      <button class="btn btn-outline btn-sm" data-view-system-issue="${issue.id}">View</button>
                      <button class="btn btn-outline btn-sm" data-edit-system-issue="${issue.id}">Edit</button>
                      <button class="btn btn-outline btn-sm" data-delete-system-issue="${issue.id}">Delete</button>
                    </div>

                    ${
                      complaintMedia.length
                        ? `
                    <div style="margin-top: 12px;">
                      <div style="font-size: 12px; font-weight: 600; color:#334155;">Complaint Media</div>
                      ${renderAdminMediaPreview(complaintMedia)}
                    </div>
                    `
                        : ""
                    }

                    ${
                      resolutionMedia.length
                        ? `
                    <div style="margin-top: 12px;">
                      <div style="font-size: 12px; font-weight: 600; color:#334155;">Resolution Proof</div>
                      ${renderAdminMediaPreview(resolutionMedia)}
                    </div>
                    `
                        : ""
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function bindAdminIssueFilters() {
  const searchInput = document.getElementById("adminIssueSearch");
  const statusFilter = document.getElementById("adminIssueStatusFilter");
  const severityFilter = document.getElementById("adminIssueSeverityFilter");

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener("input", (event) => {
      adminIssueFilters.search = event.target.value || "";
      renderAdminSystemIssues();
    });
    searchInput.dataset.bound = "true";
  }

  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.addEventListener("change", (event) => {
      adminIssueFilters.status = event.target.value || "all";
      renderAdminSystemIssues();
    });
    statusFilter.dataset.bound = "true";
  }

  if (severityFilter && !severityFilter.dataset.bound) {
    severityFilter.addEventListener("change", (event) => {
      adminIssueFilters.severity = event.target.value || "all";
      renderAdminSystemIssues();
    });
    severityFilter.dataset.bound = "true";
  }

  if (searchInput) searchInput.value = adminIssueFilters.search;
  if (statusFilter) statusFilter.value = adminIssueFilters.status;
  if (severityFilter) severityFilter.value = adminIssueFilters.severity;
}

function renderAdminEscalatedIssues() {
  const container = document.getElementById("adminEscalatedIssuesList");
  if (!container) {
    return;
  }

  const complaints = getAdminStoreComplaints()
    .filter((item) => ["reopened", "in-progress", "escalated"].includes((item.status || "").toLowerCase()))
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
  const assignments = getAdminStoreAssignments();
  const assignmentByComplaintId = new Map(assignments.map((item) => [item.complaintId, item]));

  if (complaints.length === 0) {
    container.innerHTML = '<div class="card"><div class="card-content" style="padding: 24px;">No active escalations right now.</div></div>';
    return;
  }

  container.innerHTML = complaints
    .map((complaint) => {
      const assignment = assignmentByComplaintId.get(complaint.id);
      return `
        <div class="card issue-card">
          <div class="card-content">
            <div class="issue-header">
              <div class="issue-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div class="issue-content">
                <div class="issue-title-row">
                  <div>
                    <div class="flex items-center gap-2 mb-2">
                      <h3 class="issue-title">${complaint.title}</h3>
                      <span class="badge badge-red">${getAdminSeverityLabel(complaint.category)}</span>
                      <span class="badge ${getAdminStatusBadgeClass(complaint.status)}">${formatAdminComplaintStatus(complaint.status)}</span>
                    </div>
                    <p class="issue-meta">Civic Issue ${complaint.id} • Reported by ${(complaint.reportedByEmail || complaint.reportedBy || "Citizen")}</p>
                    <p class="issue-meta"><span class="font-semibold">Location:</span> ${complaint.location || "N/A"} • <span class="font-semibold">Department:</span> ${complaint.department || "N/A"}</p>
                  </div>
                </div>

                <div class="mb-4" style="margin-top: 12px;">
                  <p class="text-sm font-semibold text-gray-700 mb-2">Assigned To:</p>
                  <p class="text-sm text-gray-600" style="margin-left: 24px;">${assignment?.assignee || "Not assigned"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAdminFlowViews() {
  renderAdminDashboardComplaintStats();
  bindAdminIssueFilters();
  if (!complaintManagementState.loaded) renderAdminSystemIssues();
  renderAdminEscalatedIssues();
  renderAdminEscalationRules();
}

function renderAdminDashboardComplaintStats() {
  // Active dashboard metrics are rendered from authenticated backend resources.
}

function generateItemId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function renderDynamicUsers() {
  const tableBody = document.getElementById("usersTableBody");
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = "";

  adminCrudState.users.forEach((user) => {
    const row = document.createElement("tr");
    row.setAttribute("data-dynamic-user", "true");
    row.dataset.userId = user.id;

    row.innerHTML = `
      <td><span class="font-semibold">${user.name}</span></td>
      <td>${user.email}</td>
      <td><span class="badge badge-blue">${user.role}</span></td>
      <td>${user.department}</td>
      <td><span class="badge badge-green">${user.status}</span></td>
      <td>${user.lastActive}</td>
      <td>
        <button class="btn btn-outline btn-sm" data-edit-user="${user.id}">Edit</button>
        <button class="btn btn-outline btn-sm" data-delete-user="${user.id}" style="margin-left: 8px;">Delete</button>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

function renderDynamicRoles() {
  const rolesGrid = document.getElementById("rolesGrid");
  if (!rolesGrid) {
    return;
  }

  rolesGrid.querySelectorAll("div[data-dynamic-role='true']").forEach((card) => {
    card.remove();
  });

  adminCrudState.roles.forEach((role) => {
    const roleCard = document.createElement("div");
    roleCard.setAttribute("data-dynamic-role", "true");
    roleCard.dataset.roleId = role.id;
    roleCard.setAttribute(
      "style",
      "padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;",
    );

    roleCard.innerHTML = `
      <h4 style="font-weight: 600; font-size: 16px; color: #111827; margin-bottom: 8px;">${role.name}</h4>
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">${role.description}</p>
      <p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;"><span class="font-semibold">Permissions:</span> ${role.permissionLevel}</p>
      <button class="btn btn-outline btn-sm" data-delete-role="${role.id}">Delete Role</button>
    `;

    rolesGrid.appendChild(roleCard);
  });
}

function renderDynamicDepartments() {
  const departmentsGrid = document.getElementById("departmentsGrid");
  if (!departmentsGrid) {
    return;
  }

  departmentsGrid
    .querySelectorAll("div[data-dynamic-department='true']")
    .forEach((card) => {
      card.remove();
    });

  adminCrudState.departments.forEach((department) => {
    const card = document.createElement("div");
    card.setAttribute("data-dynamic-department", "true");
    card.dataset.departmentId = department.id;
    card.setAttribute(
      "style",
      "padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;",
    );

    card.innerHTML = `
      <div class="flex items-center gap-3 mb-3">
        <div style="width: 40px; height: 40px; background-color: #dbeafe; color: #1d4ed8; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 600;">${department.name.charAt(0).toUpperCase()}</div>
        <div>
          <h4 style="font-weight: 600; color: #111827;">${department.name}</h4>
          <p style="font-size: 13px; color: #6b7280;">Target: ${department.responseTime} hrs</p>
        </div>
      </div>
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">${department.description}</p>
      <p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;"><span class="font-semibold">Manager:</span> ${department.manager}</p>
      <button class="btn btn-outline btn-sm" data-delete-department="${department.id}">Delete Department</button>
    `;

    departmentsGrid.appendChild(card);
  });
}

function renderAdminCrudData() {
  renderDynamicUsers();
  renderDynamicRoles();
  renderDynamicDepartments();
}

function resetAddUserForm() {
  document.getElementById("addUserName").value = "";
  document.getElementById("addUserEmail").value = "";
  document.getElementById("addUserRole").selectedIndex = 0;
  document.getElementById("addUserDepartment").selectedIndex = 0;
  document.getElementById("addUserDepartment").disabled = false;
  document.getElementById("addUserPhone").value = "";
}

function updateAddUserDepartmentField() {
  const roleSelect = document.getElementById("addUserRole");
  const departmentSelect = document.getElementById("addUserDepartment");
  if (!roleSelect || !departmentSelect) {
    return;
  }

  if (roleSelect.value === "Citizen") {
    let naOption = Array.from(departmentSelect.options).find(
      (option) => option.value === "N/A",
    );
    if (!naOption) {
      naOption = new Option("N/A", "N/A");
      departmentSelect.add(naOption);
    }
    departmentSelect.value = "N/A";
    departmentSelect.disabled = true;
    return;
  }

  departmentSelect.disabled = false;
  if (departmentSelect.value === "N/A") {
    departmentSelect.selectedIndex = 0;
  }
}

function toPasswordFromName(name) {
  const first = (name || "user").trim().split(" ")[0] || "user";
  return `${first.toLowerCase()}123`;
}

function getNextUserId() {
  const used = adminCrudState.users
    .map((user) => {
      const match = /^USR-(\d+)$/.exec(user.id || "");
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => value > 0);

  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `USR-${String(next).padStart(3, "0")}`;
}

function getRoleCodePrefix(role) {
  if (role === "Department Officer") return "DO";
  if (role === "Field Worker") return "FW";
  if (role === "Citizen") return "CT";
  return "USR";
}

function getEmployeeCode(role) {
  const prefix = getRoleCodePrefix(role);
  const count =
    adminCrudState.users.filter((user) => user.role === role).length + 1;
  return `${prefix}-${String(count).padStart(3, "0")}`;
}

function isPlaceholderOption(value) {
  return (value || "").toLowerCase().startsWith("select");
}

function findOfficerByDepartment(department) {
  return adminCrudState.users.find(
    (user) => user.role === "Department Officer" && user.department === department,
  );
}

function normalisePhone(rawPhone) {
  const trimmed = (rawPhone || "").trim();
  return trimmed || "N/A";
}

function resetCreateRoleForm() {
  document.getElementById("roleNameInput").value = "";
  document.getElementById("roleDescriptionInput").value = "";
  document.getElementById("rolePermissionSelect").selectedIndex = 0;
}

function resetCreateDepartmentForm() {
  document.getElementById("departmentNameInput").value = "";
  document.getElementById("departmentDescriptionInput").value = "";
  document.getElementById("departmentManagerSelect").selectedIndex = 0;
  document.getElementById("departmentResponseTimeInput").value = "";
}

function handleAddUser() {
  if (!hasPermission("users-roles", "create")) {
    showAdminToast("You do not have permission to create users.", "error");
    return;
  }

  const name = document.getElementById("addUserName").value.trim();
  const email = document.getElementById("addUserEmail").value.trim();
  const role = document.getElementById("addUserRole").value;
  let department = document.getElementById("addUserDepartment").value;
  const phone = normalisePhone(document.getElementById("addUserPhone").value);

  if (role === "Citizen") {
    department = "N/A";
  }

  const departmentRequired = role !== "Citizen";
  if (
    !name ||
    !email ||
    isPlaceholderOption(role) ||
    (departmentRequired && isPlaceholderOption(department))
  ) {
    showAdminToast("Please complete all required user fields.", "error");
    return;
  }

  if (name.length < 3) {
    showAdminToast("User name should be at least 3 characters.", "error");
    return;
  }

  if (!ADMIN_EMAIL_REGEX.test(email)) {
    showAdminToast("Please enter a valid user email.", "error");
    return;
  }

  if (phone !== "N/A" && !ADMIN_PHONE_REGEX.test(phone)) {
    showAdminToast("Enter a valid phone number.", "error");
    return;
  }

  const emailLower = email.toLowerCase();
  const exists = adminCrudState.users.some(
    (user) => (user.email || "").toLowerCase() === emailLower,
  );
  if (exists) {
    showAdminToast("A user with this email already exists.", "error");
    return;
  }

  let mapping = {};
  if (role === "Field Worker") {
    const officer = findOfficerByDepartment(department);
    mapping = {
      officerId: officer?.id,
      reportsTo: officer?.id,
    };
  }

  const newUser = {
    id: getNextUserId(),
    name,
    email: emailLower,
    password: toPasswordFromName(name),
    role,
    department,
    phone,
    employeeCode: getEmployeeCode(role),
    status: "Active",
    lastActive: "Just now",
    ...mapping,
  };

  if (window.MockDataAPI) {
    window.MockDataAPI.add("users", newUser);
    loadAdminCrudState();
  } else {
    adminCrudState.users.push(newUser);
    saveAdminCrudState();
  }

  renderAdminCrudData();
  resetAddUserForm();
  closeModal("addUserModal");
  showAdminToast("User added successfully.", "success");
}

function handleCreateRole() {
  if (!hasPermission("users-roles", "create")) {
    showAdminToast("You do not have permission to create roles.", "error");
    return;
  }

  const name = document.getElementById("roleNameInput").value.trim();
  const description = document.getElementById("roleDescriptionInput").value.trim();
  const permissionLevel = document.getElementById("rolePermissionSelect").value;

  if (!name || !description) {
    showAdminToast("Please provide role name and description.", "error");
    return;
  }

  if (name.length < 3) {
    showAdminToast("Role name should be at least 3 characters.", "error");
    return;
  }

  if (description.length < 10) {
    showAdminToast("Role description should be at least 10 characters.", "error");
    return;
  }

  const roleExists = adminCrudState.roles.some(
    (role) => role.name.toLowerCase() === name.toLowerCase(),
  );
  if (roleExists) {
    showAdminToast("A role with this name already exists.", "error");
    return;
  }

  const newRole = {
    id: generateItemId("role"),
    name,
    description,
    permissionLevel,
  };

  if (window.MockDataAPI) {
    window.MockDataAPI.add("roles", newRole);
    loadAdminCrudState();
  } else {
    adminCrudState.roles.push(newRole);
    saveAdminCrudState();
  }

  renderDynamicRoles();
  resetCreateRoleForm();
  closeModal("createRoleModal");
  showAdminToast("Role created successfully.", "success");
}

function handleCreateDepartment() {
  if (!hasPermission("users-roles", "create")) {
    showAdminToast("You do not have permission to create departments.", "error");
    return;
  }

  const name = document.getElementById("departmentNameInput").value.trim();
  const description = document
    .getElementById("departmentDescriptionInput")
    .value.trim();
  const manager = document.getElementById("departmentManagerSelect").value;
  const responseTime = document
    .getElementById("departmentResponseTimeInput")
    .value.trim();

  if (!name || !description || manager === "Select manager" || !responseTime) {
    showAdminToast("Please complete all required department fields.", "error");
    return;
  }

  if (name.length < 3) {
    showAdminToast("Department name should be at least 3 characters.", "error");
    return;
  }

  if (description.length < 10) {
    showAdminToast("Department description should be at least 10 characters.", "error");
    return;
  }

  const responseHours = Number(responseTime);
  if (!Number.isFinite(responseHours) || responseHours <= 0 || responseHours > 168) {
    showAdminToast("Response time should be between 1 and 168 hours.", "error");
    return;
  }

  const departmentExists = adminCrudState.departments.some(
    (department) => department.name.toLowerCase() === name.toLowerCase(),
  );
  if (departmentExists) {
    showAdminToast("A department with this name already exists.", "error");
    return;
  }

  const newDepartment = {
    id: generateItemId("department"),
    name,
    description,
    manager,
    responseTime,
  };

  if (window.MockDataAPI) {
    window.MockDataAPI.add("departments", newDepartment);
    loadAdminCrudState();
  } else {
    adminCrudState.departments.push(newDepartment);
    saveAdminCrudState();
  }

  renderDynamicDepartments();
  resetCreateDepartmentForm();
  closeModal("createDepartmentModal");
  showAdminToast("Department created successfully.", "success");
}

document.addEventListener("click", async (evt) => {
  const viewSystemIssueId = evt.target.getAttribute("data-view-system-issue");
  const editSystemIssueId = evt.target.getAttribute("data-edit-system-issue");
  const deleteSystemIssueId = evt.target.getAttribute("data-delete-system-issue");
  const readRuleId = evt.target.getAttribute("data-read-rule");
  const editRuleId = evt.target.getAttribute("data-edit-rule");
  const deleteRuleId = evt.target.getAttribute("data-delete-rule");
  const editUserId = evt.target.getAttribute("data-edit-user");
  const deleteUserId = evt.target.getAttribute("data-delete-user");
  const deleteRoleId = evt.target.getAttribute("data-delete-role");
  const deleteDepartmentId = evt.target.getAttribute("data-delete-department");

  if (viewSystemIssueId) {
    await handleViewTechnicalSystemIssue(viewSystemIssueId);
    return;
  }

  if (editSystemIssueId) {
    await handleEditTechnicalSystemIssue(editSystemIssueId);
    return;
  }

  if (deleteSystemIssueId) {
    await handleDeleteTechnicalSystemIssue(deleteSystemIssueId);
    return;
  }

  if (readRuleId) {
    await handleReadEscalationRule(readRuleId);
    return;
  }

  if (editRuleId) {
    handleEditEscalationRule(editRuleId);
    return;
  }

  if (deleteRuleId) {
    await handleDeleteEscalationRule(deleteRuleId);
    return;
  }

  if (editUserId) {
    if (!hasPermission("users-roles", "update")) {
      showAdminToast("You do not have permission to update users.", "error");
      return;
    }

    const user = adminCrudState.users.find((item) => item.id === editUserId);
    if (!user) {
      return;
    }

    const result = await showAdminDialog({
      title: "Update User Name",
      message: "Enter the updated user name.",
      confirmText: "Save",
      cancelText: "Cancel",
      inputValue: user.name,
    });

    const nextName = (result.value || "").trim();
    if (!result.confirmed || !nextName) {
      return;
    }

    user.name = nextName;
    user.lastActive = "Just updated";
    if (window.MockDataAPI) {
      window.MockDataAPI.update("users", user.id, {
        name: user.name,
        lastActive: user.lastActive,
      });
      loadAdminCrudState();
    } else {
      saveAdminCrudState();
    }
    renderDynamicUsers();
    showAdminToast("User updated successfully.", "success");
    return;
  }

  if (deleteUserId) {
    if (!hasPermission("users-roles", "delete")) {
      showAdminToast("You do not have permission to delete users.", "error");
      return;
    }

    if (window.MockDataAPI) {
      window.MockDataAPI.remove("users", deleteUserId);
      loadAdminCrudState();
    } else {
      adminCrudState.users = adminCrudState.users.filter((item) => item.id !== deleteUserId);
      saveAdminCrudState();
    }
    renderDynamicUsers();
    showAdminToast("User deleted.", "success");
    return;
  }

  if (deleteRoleId) {
    if (!hasPermission("users-roles", "delete")) {
      showAdminToast("You do not have permission to delete roles.", "error");
      return;
    }

    if (window.MockDataAPI) {
      window.MockDataAPI.remove("roles", deleteRoleId);
      loadAdminCrudState();
    } else {
      adminCrudState.roles = adminCrudState.roles.filter((item) => item.id !== deleteRoleId);
      saveAdminCrudState();
    }
    renderDynamicRoles();
    showAdminToast("Role deleted.", "success");
    return;
  }

  if (deleteDepartmentId) {
    if (!hasPermission("users-roles", "delete")) {
      showAdminToast("You do not have permission to delete departments.", "error");
      return;
    }

    if (window.MockDataAPI) {
      window.MockDataAPI.remove("departments", deleteDepartmentId);
      loadAdminCrudState();
    } else {
      adminCrudState.departments = adminCrudState.departments.filter(
        (item) => item.id !== deleteDepartmentId,
      );
      saveAdminCrudState();
    }
    renderDynamicDepartments();
    showAdminToast("Department deleted.", "success");
  }
});

document.getElementById("addUserRole")?.addEventListener("change", updateAddUserDepartmentField);

function formatSubscriptionAmount(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);
}

async function showSubscriptionManagement() {
  let page = document.getElementById("page-subscription");
  if (!page) { page = document.createElement("div"); page.id = "page-subscription"; page.className = "hidden"; document.getElementById("pageContent")?.appendChild(page); }
  page.innerHTML = '<section class="community-dashboard-loading"><span class="dashboard-loader"></span><div><p class="eyebrow">PLAN &amp; BILLING</p><h1>Loading your subscription</h1></div></section>';
  try {
    const subscription = (await adminApiRequest("/subscriptions/me")).data;
    page.innerHTML = `<div class="page-header-with-action"><div><h1 class="page-title">Plan &amp; Billing</h1><p class="page-description">Review your contracted capacity and upgrade when your community grows.</p></div></div><section class="card"><div class="card-content"><div class="payment-details"><div><span>Current towers</span><b>${subscription.contractedTowers}</b></div><div><span>Current apartments</span><b>${subscription.contractedApartments}</b></div><div><span>Current plan amount</span><b>${formatSubscriptionAmount(subscription.amount)}</b></div><div><span>Plan status</span><b>${hierarchyEscape(subscription.status)}</b></div></div><form id="upgradePlanForm" class="payment-form"><h3 class="card-title">Upgrade capacity</h3><p>Only increases are allowed. The extra amount is calculated by the backend using your contracted rates.</p><label>New tower capacity<input class="form-input" type="number" name="contractedTowers" min="${subscription.contractedTowers}" value="${subscription.contractedTowers}" required></label><label>New apartment capacity<input class="form-input" type="number" name="contractedApartments" min="${subscription.contractedApartments}" value="${subscription.contractedApartments}" required></label><div class="payment-actions"><button type="submit" class="btn btn-primary">Review upgrade price</button></div></form><p id="upgradeMessage" class="payment-message" role="status"></p></div></section>`;
    document.getElementById("upgradePlanForm").onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; const submit = form.querySelector('[type="submit"]'); submit.disabled = true; try { const values = Object.fromEntries(new FormData(form)); const upgraded = (await adminApiRequest("/subscriptions/me/upgrade", { method: "POST", body: { contractedTowers: Number(values.contractedTowers), contractedApartments: Number(values.contractedApartments) } })).data; page.innerHTML = `<section class="payment-workspace"><p class="payment-kicker">Plan upgrade</p><h1>Review extra payment</h1><p>Your new capacity will be available after the mock payment is confirmed.</p><div class="payment-details"><div><span>New towers</span><b>${upgraded.pendingContractedTowers}</b></div><div><span>New apartments</span><b>${upgraded.pendingContractedApartments}</b></div><div><span>Extra amount due</span><b>${formatSubscriptionAmount(upgraded.pendingUpgradeAmount)}</b></div><div><span>New plan amount</span><b>${formatSubscriptionAmount(upgraded.pendingContractedTowers * upgraded.towerRate + upgraded.pendingContractedApartments * upgraded.apartmentRate)}</b></div></div><form id="upgradePaymentForm" class="payment-form"><label>Payment method<select class="form-select" required><option>Card</option><option>UPI</option><option>Net banking</option></select></label><div class="payment-actions"><button type="button" id="cancelUpgrade" class="btn btn-outline">Back</button><button type="submit" class="btn btn-primary">Pay ${formatSubscriptionAmount(upgraded.pendingUpgradeAmount)}</button></div></form><p id="upgradeMessage" class="payment-message" role="status"></p></section>`; document.getElementById("cancelUpgrade").onclick = showSubscriptionManagement; document.getElementById("upgradePaymentForm").onsubmit = async (paymentEvent) => { paymentEvent.preventDefault(); const pay = paymentEvent.currentTarget.querySelector('[type="submit"]'); pay.disabled = true; pay.textContent = "Confirming payment…"; try { await adminApiRequest("/subscriptions/me/upgrade/mock-payment", { method: "POST" }); page.innerHTML = `<section class="payment-workspace payment-success"><p class="payment-kicker">Upgrade complete</p><div class="payment-success-icon">✓</div><h1>New capacity is active</h1><p>Your community can now create additional towers and apartments within the upgraded limits.</p><button id="viewUpdatedPlan" class="btn btn-primary">View updated plan</button></section>`; document.getElementById("viewUpdatedPlan").onclick = showSubscriptionManagement; } catch (error) { pay.disabled = false; pay.textContent = "Pay upgrade"; document.getElementById("upgradeMessage").textContent = error.message || "Unable to confirm upgrade payment."; } }; } catch (error) { submit.disabled = false; document.getElementById("upgradeMessage").textContent = error.message || "Unable to calculate upgrade price."; } };
  } catch (error) { page.innerHTML = `<section class="card"><div class="card-content"><p class="payment-message">${hierarchyEscape(error.message || "Unable to load subscription details.")}</p></div></section>`; }
}

function renderPaymentWorkspace(subscription) {
  document.querySelector(".sidebar")?.classList.add("subscription-locked");
  const page = document.getElementById("pageContent");
  const summary = `<div class="payment-details"><div><span>Community</span><b>${hierarchyEscape(subscription.communityName || "Your community")}</b></div><div><span>Contracted towers</span><b>${subscription.contractedTowers}</b></div><div><span>Contracted apartments</span><b>${subscription.contractedApartments}</b></div><div><span>Subscription amount</span><b>${formatSubscriptionAmount(subscription.amount)}</b></div></div>`;
  const showCheckout = () => {
    page.innerHTML = `<section class="payment-workspace"><p class="payment-kicker">Secure checkout</p><h1>Payment details</h1><p>Review your order and enter customer details to continue.</p>${summary}<form id="mockPaymentForm" class="payment-form"><label>Customer name<input class="form-input" name="customerName" required></label><label>Email address<input class="form-input" name="email" type="email" required></label><label>Phone number<input class="form-input" name="phone" inputmode="tel" required></label><label>Payment method<select class="form-select" name="method" required><option value="CARD">Card</option><option value="UPI">UPI</option><option value="NET_BANKING">Net banking</option></select></label><div class="payment-actions"><button id="backToPricing" type="button" class="btn btn-outline">Back</button><button type="submit" class="btn btn-primary">Pay ${formatSubscriptionAmount(subscription.amount)}</button></div></form><p id="paymentMessage" class="payment-message" role="status"></p></section>`;
    document.getElementById("backToPricing").onclick = () => renderPaymentWorkspace(subscription);
    document.getElementById("mockPaymentForm").onsubmit = async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true; button.textContent = "Confirming payment…"; try { const response = await adminApiRequest("/subscriptions/me/mock-payment", { method: "POST" }); if (response.data?.status !== "ACTIVE") throw new Error("Payment confirmation is still pending."); page.innerHTML = `<section class="payment-workspace payment-success"><p class="payment-kicker">Payment successful</p><div class="payment-success-icon">✓</div><h1>You're all set</h1><p>Your payment of <b>${formatSubscriptionAmount(subscription.amount)}</b> was confirmed. Community setup is now available.</p><button id="openCommunityWorkspace" class="btn btn-primary">Open community workspace</button></section>`; document.querySelector(".sidebar")?.classList.remove("subscription-locked"); document.getElementById("openCommunityWorkspace").onclick = loadActiveAdminWorkspace; } catch (error) { button.disabled = false; button.textContent = `Pay ${formatSubscriptionAmount(subscription.amount)}`; document.getElementById("paymentMessage").textContent = error.message || "Unable to confirm payment."; } };
  };
  page.innerHTML = `<section class="payment-workspace"><p class="payment-kicker">Subscription activation required</p><h1>Review your subscription</h1><p>Complete the secure mock checkout to unlock community setup.</p>${summary}<p class="payment-status">Payment pending</p><div class="payment-actions"><button id="continueToPayment" class="btn btn-primary">Continue to payment</button></div></section>`;
  document.getElementById("continueToPayment").onclick = showCheckout;
}

async function loadActiveAdminWorkspace() {
  renderAdminAnalyticsLoading();
  try {
    await loadHierarchyData(); await loadManagedUsers(); await loadManagedWorkers(); await loadManagedComplaints();
    renderComplaintManagement(); applyCurrentUserToAdminUI(); navigateTo(getSavedAdminPage());
  } catch (error) { showAdminToast(error.message || "Unable to load Admin management data.", "error"); }
}

async function initializeAdminPortal() {
  if (!window.UrbanityApi?.getAccessToken()) {
    window.UrbanityApi?.logout();
    return;
  }

  try {
    const backendUser = await window.UrbanityApi.getCurrentUser();
    if (backendUser?.role !== "COMMUNITY_ADMIN") {
      showAdminToast("Access denied: this portal is only for Community Admins.", "error");
      window.UrbanityApi.clearSession();
      window.setTimeout(() => window.UrbanityApi.logout(), 900);
      return;
    }

    authenticatedAdmin = true;
    authenticatedAdminUser = backendUser;
    applyCurrentUserToAdminUI();
    const subscription = (await adminApiRequest("/subscriptions/me")).data;
    if (subscription.status !== "ACTIVE") return renderPaymentWorkspace(subscription);
    await loadActiveAdminWorkspace();
  } catch (error) {
    // UrbanityApi handles invalid/expired-token session cleanup and redirect.
    if (error?.status !== 401) {
      showAdminToast(error?.message || "Unable to verify the Admin session.", "error");
    }
  }
}

initializeAdminPortal();

// Close dropdown when clicking outside
document.addEventListener("click", function (event) {
  const dropdown = document.querySelector(".dropdown");
  const dropdownMenu = document.getElementById("profileDropdown");

  if (dropdown && !dropdown.contains(event.target)) {
    dropdownMenu.classList.remove("active");
  }
});

// Close modal when clicking outside
document.addEventListener("click", function (event) {
  if (event.target.classList.contains("modal-overlay")) {
    event.target.classList.remove("active");
  }
});
