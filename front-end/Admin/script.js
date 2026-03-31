const ADMIN_MODULES = [
  "dashboard",
  "system-issues",
  "escalated-issues",
  "users-roles",
  "system-settings",
  "activity-monitor",
  "profile",
];

const SUPER_USER_PERMISSIONS = ADMIN_MODULES.reduce((acc, moduleName) => {
  acc[moduleName] = ["create", "read", "update", "delete"];
  return acc;
}, {});

const ADMIN_PAGE_STATE_KEY = "urbanity.admin.lastPage";

function getRoleContext() {
  const stored = sessionStorage.getItem("urbanityRoleContext");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error("Invalid role context found.", error);
    }
  }

  return null;
}

const roleContext = getRoleContext() || {};

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
  const stored = sessionStorage.getItem("urbanityCurrentUser");
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("Invalid current user context found.", error);
    return null;
  }
}

function applyCurrentUserToAdminUI() {
  const currentUser = getCurrentSessionUser();
  if (!currentUser) {
    return;
  }

  const initials = (currentUser.name || "A")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const headerName = document.querySelector(".user-name");
  const headerEmail = document.querySelector(".user-email");
  const headerAvatar = document.querySelector(".user-avatar");

  if (headerName) headerName.textContent = currentUser.name || "Admin User";
  if (headerEmail) headerEmail.textContent = currentUser.email || "admin@urbanity.gov";
  if (headerAvatar) headerAvatar.textContent = initials;

  const profileName = document.getElementById("adminProfileName");
  const infoName = document.getElementById("adminInfoName");
  const infoEmail = document.getElementById("adminInfoEmail");
  const profileAvatar = document.getElementById("adminProfileAvatar");

  if (profileName) profileName.textContent = currentUser.name || "Admin User";
  if (infoName) infoName.textContent = currentUser.name || "Admin User";
  if (infoEmail) infoEmail.textContent = currentUser.email || "admin@urbanity.gov";
  if (profileAvatar) profileAvatar.textContent = initials;
}

if (roleContext.role !== "super_user_admin") {
  showAdminToast("Access denied: This portal is only for Admin. Redirecting to sign in.", "error");
  window.setTimeout(() => {
    window.location.href = "../Authentication/auth.html";
  }, 900);
}

applyCurrentUserToAdminUI();

function hasPermission(moduleName, action) {
  const permissions = roleContext.permissions || {};
  const wildcard = permissions["*"] || [];
  const moduleAccess = permissions[moduleName] || [];
  return wildcard.includes(action) || moduleAccess.includes(action);
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

  // Hide all pages
  const pages = document.querySelectorAll('[id^="page-"]');
  pages.forEach((p) => p.classList.add("hidden"));

  // Show selected page
  const selectedPage = document.getElementById("page-" + page);
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
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
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
  sessionStorage.removeItem("urbanityRoleContext");
  sessionStorage.removeItem("urbanityRole");
  sessionStorage.removeItem("urbanityRoleLabel");
  sessionStorage.removeItem("urbanityCurrentUser");
  window.location.href = "../Landing Page/landingpage.html";
}

document.querySelector(".signout-btn")?.addEventListener("click", signOut);
document.querySelector(".dropdown-signout")?.addEventListener("click", signOut);

const ADMIN_STORE_KEY = "urbanityAdminCrudData";

const adminIssueFilters = {
  search: "",
  department: "all",
  status: "all",
  feedback: "all",
};

const adminCrudState = {
  users: [],
  roles: [],
  departments: [],
};

const ADMIN_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_PHONE_REGEX = /^\+?[0-9()\-\s]{8,20}$/;

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

  const complaints = getAdminStoreComplaints()
    .filter((complaint) => {
      const normalizedStatus = (complaint.status || "").toLowerCase();
      const normalizedDepartment = (complaint.department || "").toLowerCase();
      const hasFeedback = Boolean(complaint.feedback);

      if (adminIssueFilters.department !== "all") {
        const selectedDepartment = adminIssueFilters.department.toLowerCase();
        if (normalizedDepartment !== selectedDepartment) {
          return false;
        }
      }

      if (adminIssueFilters.status !== "all" && normalizedStatus !== adminIssueFilters.status) {
        return false;
      }

      if (adminIssueFilters.feedback === "pending") {
        if (!(normalizedStatus === "resolved" && !hasFeedback)) {
          return false;
        }
      }

      if (adminIssueFilters.feedback === "submitted" && !hasFeedback) {
        return false;
      }

      const query = adminIssueFilters.search.trim().toLowerCase();
      if (!query) {
        return true;
      }

      const searchable = [
        complaint.id,
        complaint.title,
        complaint.description,
        complaint.location,
        complaint.reportedBy,
        complaint.reportedByEmail,
        complaint.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    })
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
  const assignments = getAdminStoreAssignments();
  const assignmentByComplaintId = new Map(assignments.map((item) => [item.complaintId, item]));

  if (complaints.length === 0) {
    container.innerHTML = '<div class="card"><div class="card-content" style="padding: 24px;">No civic complaints found.</div></div>';
    return;
  }

  container.innerHTML = complaints
    .map((complaint) => {
      const assignment = assignmentByComplaintId.get(complaint.id);
      const complaintMedia = normalizeAdminMediaList(complaint.media);
      const resolutionMedia = normalizeAdminMediaList(
        complaint.resolutionMedia && complaint.resolutionMedia.length
          ? complaint.resolutionMedia
          : assignment?.proofMedia,
      );
      const feedbackLabel = complaint.feedback
        ? `Feedback: ${complaint.feedback.rating}/5`
        : complaint.status === "resolved"
          ? "Feedback: pending"
          : "Feedback: N/A";

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
                      <h3 class="font-semibold" style="color: #111827;">${complaint.title}</h3>
                      <span class="badge ${getAdminSeverityBadgeClass(complaint.category)}" style="text-transform: uppercase; font-size: 11px;">${getAdminSeverityLabel(complaint.category)}</span>
                      <span class="badge ${getAdminStatusBadgeClass(complaint.status)}" style="text-transform: uppercase; font-size: 11px;">${formatAdminComplaintStatus(complaint.status)}</span>
                    </div>
                    <p class="text-sm" style="color: #4b5563; margin-bottom: 12px;">${complaint.description || "No description"}</p>
                    <div class="flex items-center gap-6 text-sm" style="color: #6b7280; flex-wrap: wrap;">
                      <span class="font-medium">${complaint.id}</span>
                      <span>Assigned: ${assignment?.assignee || "Unassigned"}</span>
                      <span>Reported by: ${complaint.reportedBy || "Citizen"}</span>
                      <span>${complaint.date || "N/A"}</span>
                      <span>${feedbackLabel}</span>
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

function renderAdminIssueFilterOptions() {
  const departmentFilter = document.getElementById("adminIssueDepartmentFilter");
  if (!departmentFilter) {
    return;
  }

  const selected = departmentFilter.value || adminIssueFilters.department;
  const departments = Array.from(
    new Set(
      getAdminStoreComplaints()
        .map((complaint) => complaint.department)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  departmentFilter.innerHTML = [
    '<option value="all">All Departments</option>',
    ...departments.map((department) => `<option value="${department}">${department}</option>`),
  ].join("");

  if (selected && Array.from(departmentFilter.options).some((option) => option.value === selected)) {
    departmentFilter.value = selected;
  } else {
    departmentFilter.value = "all";
    adminIssueFilters.department = "all";
  }
}

function bindAdminIssueFilters() {
  const searchInput = document.getElementById("adminIssueSearch");
  const departmentFilter = document.getElementById("adminIssueDepartmentFilter");
  const statusFilter = document.getElementById("adminIssueStatusFilter");
  const feedbackFilter = document.getElementById("adminIssueFeedbackFilter");

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener("input", (event) => {
      adminIssueFilters.search = event.target.value || "";
      renderAdminSystemIssues();
    });
    searchInput.dataset.bound = "true";
  }

  if (departmentFilter && !departmentFilter.dataset.bound) {
    departmentFilter.addEventListener("change", (event) => {
      adminIssueFilters.department = event.target.value || "all";
      renderAdminSystemIssues();
    });
    departmentFilter.dataset.bound = "true";
  }

  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.addEventListener("change", (event) => {
      adminIssueFilters.status = event.target.value || "all";
      renderAdminSystemIssues();
    });
    statusFilter.dataset.bound = "true";
  }

  if (feedbackFilter && !feedbackFilter.dataset.bound) {
    feedbackFilter.addEventListener("change", (event) => {
      adminIssueFilters.feedback = event.target.value || "all";
      renderAdminSystemIssues();
    });
    feedbackFilter.dataset.bound = "true";
  }

  if (searchInput) searchInput.value = adminIssueFilters.search;
  if (departmentFilter) departmentFilter.value = adminIssueFilters.department;
  if (statusFilter) statusFilter.value = adminIssueFilters.status;
  if (feedbackFilter) feedbackFilter.value = adminIssueFilters.feedback;
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
  renderAdminIssueFilterOptions();
  bindAdminIssueFilters();
  renderAdminSystemIssues();
  renderAdminEscalatedIssues();
}

function renderAdminDashboardComplaintStats() {
  const stats = document.querySelectorAll("#page-dashboard .stat-value");
  if (stats.length < 4) {
    return;
  }

  const complaints = getAdminStoreComplaints();
  if (complaints.length === 0) {
    return;
  }

  const total = complaints.length;
  const resolved = complaints.filter((entry) => entry.status === "resolved").length;
  const pending = complaints.filter((entry) => entry.status === "pending").length;
  const escalated = complaints.filter(
    (entry) =>
      entry.status === "escalated" ||
      entry.status === "reopened" ||
      entry.status === "in-progress",
  ).length;

  stats[0].textContent = String(total);
  stats[1].textContent = String(resolved);
  stats[2].textContent = String(pending);
  stats[3].textContent = String(escalated);
  renderAdminFlowViews();
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
  if (role === "Department Head") return "DH";
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

function findHeadByDepartment(department) {
  return adminCrudState.users.find(
    (user) => user.role === "Department Head" && user.department === department,
  );
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
    showAdminToast("Please enter a valid phone number.", "error");
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
  if (role === "Department Officer") {
    const head = findHeadByDepartment(department);
    if (head) {
      mapping = { reportsTo: head.id, headId: head.id };
    }
  }

  if (role === "Field Worker") {
    const officer = findOfficerByDepartment(department);
    const head = findHeadByDepartment(department);
    mapping = {
      officerId: officer?.id,
      reportsTo: officer?.id || head?.id,
      headId: officer?.headId || head?.id,
    };
  }

  adminCrudState.users.push({
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
  });

  saveAdminCrudState();
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

  adminCrudState.roles.push({
    id: generateItemId("role"),
    name,
    description,
    permissionLevel,
  });

  saveAdminCrudState();
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

  adminCrudState.departments.push({
    id: generateItemId("department"),
    name,
    description,
    manager,
    responseTime,
  });

  saveAdminCrudState();
  renderDynamicDepartments();
  resetCreateDepartmentForm();
  closeModal("createDepartmentModal");
  showAdminToast("Department created successfully.", "success");
}

document.addEventListener("click", async (evt) => {
  const editUserId = evt.target.getAttribute("data-edit-user");
  const deleteUserId = evt.target.getAttribute("data-delete-user");
  const deleteRoleId = evt.target.getAttribute("data-delete-role");
  const deleteDepartmentId = evt.target.getAttribute("data-delete-department");

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
    saveAdminCrudState();
    renderDynamicUsers();
    showAdminToast("User updated successfully.", "success");
    return;
  }

  if (deleteUserId) {
    if (!hasPermission("users-roles", "delete")) {
      showAdminToast("You do not have permission to delete users.", "error");
      return;
    }

    adminCrudState.users = adminCrudState.users.filter((item) => item.id !== deleteUserId);
    saveAdminCrudState();
    renderDynamicUsers();
    showAdminToast("User deleted.", "success");
    return;
  }

  if (deleteRoleId) {
    if (!hasPermission("users-roles", "delete")) {
      showAdminToast("You do not have permission to delete roles.", "error");
      return;
    }

    adminCrudState.roles = adminCrudState.roles.filter((item) => item.id !== deleteRoleId);
    saveAdminCrudState();
    renderDynamicRoles();
    showAdminToast("Role deleted.", "success");
    return;
  }

  if (deleteDepartmentId) {
    if (!hasPermission("users-roles", "delete")) {
      showAdminToast("You do not have permission to delete departments.", "error");
      return;
    }

    adminCrudState.departments = adminCrudState.departments.filter(
      (item) => item.id !== deleteDepartmentId,
    );
    saveAdminCrudState();
    renderDynamicDepartments();
    showAdminToast("Department deleted.", "success");
  }
});

document.getElementById("addUserRole")?.addEventListener("change", updateAddUserDepartmentField);

loadAdminCrudState();
loadAdminCrudState();
renderAdminCrudData();
renderAdminFlowViews();
navigateTo(getSavedAdminPage());

window.addEventListener("focus", renderAdminFlowViews);

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
