// Store profile data
let profileData = {
  name: "Officer Smith",
  email: "officer@urbanity.gov",
  phone: "+1-234-567-8900",
  designation: "Department Officer",
  department: "Public Works Department",
  location: "District Office, Block A",
};

const OFFICER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OFFICER_PHONE_REGEX = /^\+?[0-9()\-\s]{8,20}$/;

function showOfficerToast(message, type = "info") {
  if (window.UIFeedback?.toast) {
    window.UIFeedback.toast({ scope: "officer", message, type });
    return;
  }
  console[type === "error" ? "error" : "log"](message);
}

function setOfficerFormMessage(formId, text, type = "error") {
  const form = document.getElementById(formId);
  if (!form) {
    return;
  }

  let node = form.querySelector(".form-feedback");
  if (!node) {
    node = document.createElement("div");
    node.className = "form-feedback";
    node.setAttribute("role", "alert");
    node.setAttribute("aria-live", "polite");
    form.appendChild(node);
  }

  if (!text) {
    node.style.display = "none";
    node.textContent = "";
    return;
  }

  node.style.display = "block";
  node.textContent = text;
  node.classList.remove("form-feedback-error", "form-feedback-success");
  node.classList.add(type === "success" ? "form-feedback-success" : "form-feedback-error");
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

function applySessionUserToOfficer() {
  const currentUser = getCurrentSessionUser();
  if (!currentUser) {
    return;
  }

  profileData.name = currentUser.name || profileData.name;
  profileData.email = currentUser.email || profileData.email;
  profileData.department = currentUser.department || profileData.department;

  const initials = profileData.name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const headerName = document.querySelector(".user-name");
  const headerEmail = document.querySelector(".user-email");
  const headerAvatar = document.querySelector(".user-avatar");

  if (headerName) headerName.textContent = profileData.name;
  if (headerEmail) headerEmail.textContent = profileData.email;
  if (headerAvatar) headerAvatar.textContent = initials;

  const profileName = document.getElementById("profileName");
  const infoName = document.getElementById("infoName");
  const infoEmail = document.getElementById("infoEmail");

  if (profileName) profileName.textContent = profileData.name;
  if (infoName) infoName.textContent = profileData.name;
  if (infoEmail) infoEmail.textContent = profileData.email;
}

function getStoreUsers() {
  if (!window.MockDataAPI) {
    return [];
  }
  return window.MockDataAPI.list("users");
}

function getStoreAssignments() {
  if (!window.MockDataAPI) {
    return [];
  }
  return window.MockDataAPI.list("assignments");
}

function getStoreComplaints() {
  if (!window.MockDataAPI) {
    return [];
  }
  return window.MockDataAPI.list("complaints");
}

function getCurrentOfficerRecord() {
  const sessionUser = getCurrentSessionUser();
  if (!sessionUser) {
    return null;
  }

  const users = getStoreUsers();
  return (
    users.find((user) => user.id === sessionUser.id) ||
    users.find((user) => user.email === sessionUser.email) ||
    sessionUser
  );
}

function getOfficerHierarchy() {
  const users = getStoreUsers();
  const officer = getCurrentOfficerRecord();

  if (!officer) {
    return {
      officer: null,
      head: null,
      workers: [],
    };
  }

  const head = users.find((user) => user.id === officer.headId) || null;
  let workers = users.filter((user) => user.role === "Field Worker" && user.officerId === officer.id);

  if (workers.length === 0 && officer.department) {
    workers = users.filter(
      (user) => user.role === "Field Worker" && user.department === officer.department,
    );
  }

  return {
    officer,
    head,
    workers,
  };
}

function renderOfficerWorkerTable() {
  const { workers } = getOfficerHierarchy();
  const assignments = getStoreAssignments();
  const body = document.querySelector("#field-workers .complaints-table tbody");

  if (!body) {
    return;
  }

  if (workers.length === 0) {
    body.innerHTML = '<tr><td colspan="7">No field workers mapped to your profile yet.</td></tr>';
  } else {
    body.innerHTML = workers
      .map((worker, index) => {
        const assigned = assignments.filter(
          (entry) => entry.assigneeId === worker.id || entry.assignee === worker.name,
        );
        const completed = assigned.filter((entry) => entry.status === "Completed").length;
        return `
          <tr>
            <td>W${String(index + 1).padStart(3, "0")}</td>
            <td>${worker.name}</td>
            <td>${worker.department}</td>
            <td><span class="status-badge status-active">Active</span></td>
            <td>${assigned.length}</td>
            <td>${completed}</td>
            <td>${worker.phone || "N/A"}</td>
          </tr>
        `;
      })
      .join("");
  }

  const stats = document.querySelectorAll("#field-workers .stat-value");
  if (stats.length >= 3) {
    const relatedAssignments = assignments.filter((entry) =>
      workers.some((worker) => entry.assigneeId === worker.id || entry.assignee === worker.name),
    );
    const completed = relatedAssignments.filter((entry) => entry.status === "Completed").length;

    stats[0].textContent = String(workers.length);
    stats[1].textContent = String(relatedAssignments.length);
    stats[2].textContent = String(completed);
  }
}

function renderAssignWorkerOptions() {
  const { workers } = getOfficerHierarchy();
  const assignments = getStoreAssignments();
  const listNode = document.querySelector("#assignWorkerModal .worker-list");

  if (!listNode) {
    return;
  }

  if (workers.length === 0) {
    listNode.innerHTML = '<div class="worker-info">No workers available under your department.</div>';
    return;
  }

  listNode.innerHTML = workers
    .map((worker) => {
      const activeTasks = assignments.filter(
        (entry) =>
          (entry.assigneeId === worker.id || entry.assignee === worker.name) &&
          entry.status !== "Completed",
      ).length;
      const completed = assignments.filter(
        (entry) =>
          (entry.assigneeId === worker.id || entry.assignee === worker.name) &&
          entry.status === "Completed",
      ).length;

      return `
        <div class="worker-item" onclick="selectWorker(this, '${worker.id}', '${worker.name}')">
          <div class="worker-header">
            <span class="worker-name">${worker.name}</span>
            <span class="worker-badge">Available</span>
          </div>
          <div class="worker-info">Active Tasks: ${activeTasks} | Completed: ${completed}</div>
        </div>
      `;
    })
    .join("");
}

function getOfficerScopedComplaints() {
  const complaints = getStoreComplaints();
  const assignments = getStoreAssignments();
  const { officer } = getOfficerHierarchy();

  if (!officer) {
    return [];
  }

  const scopedComplaintIds = new Set(
    assignments
      .filter((entry) => entry.officerId === officer.id)
      .map((entry) => entry.complaintId),
  );

  complaints
    .filter((entry) => entry.department === officer.department)
    .forEach((entry) => scopedComplaintIds.add(entry.id));

  const scopedComplaints = complaints.filter((entry) => scopedComplaintIds.has(entry.id));
  return scopedComplaints.sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

function getOfficerScopedAssignments() {
  const assignments = getStoreAssignments();
  const { officer } = getOfficerHierarchy();

  if (!officer) {
    return assignments;
  }

  return assignments.filter((entry) => entry.officerId === officer.id);
}

function getOfficerAssignmentByComplaintId(complaintId) {
  return getOfficerScopedAssignments().find((entry) => entry.complaintId === complaintId) || null;
}

function getOfficerCategoryClass(category) {
  const map = {
    infrastructure: "category-roads",
    roads: "category-roads",
    sanitation: "category-sanitation",
    electricity: "category-electricity",
    water: "category-water",
    parks: "category-parks",
  };
  return map[(category || "").toLowerCase()] || "category-roads";
}

function getOfficerPriorityClass(category) {
  const highCategories = ["infrastructure", "roads", "water"];
  return highCategories.includes((category || "").toLowerCase())
    ? "priority-high"
    : "priority-medium";
}

function getOfficerStatusClass(status) {
  const map = {
    pending: "status-new",
    "in-progress": "status-in-progress",
    resolved: "status-assigned",
    reopened: "status-reopened",
  };
  return map[(status || "").toLowerCase()] || "status-assigned";
}

function toShortDate(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString();
  }
  return value || "N/A";
}

function getOfficerPriorityLabel(category) {
  return getOfficerPriorityClass(category) === "priority-high" ? "High" : "Medium";
}

function renderValidateAssignComplaints() {
  const body = document.getElementById("validateAssignRows");
  if (!body) {
    return;
  }

  const actionableStatuses = new Set(["pending", "in-progress"]);
  const complaints = getOfficerScopedComplaints().filter(
    (entry) => actionableStatuses.has(String(entry.status || "").toLowerCase()),
  );

  if (complaints.length === 0) {
    body.innerHTML = '<tr><td colspan="7">No pending complaints waiting for assignment.</td></tr>';
    return;
  }

  body.innerHTML = complaints
    .map((complaint) => {
      const category = (complaint.category || "Other").toLowerCase();
      const priorityClass = getOfficerPriorityClass(complaint.category);
      const priorityLabel = getOfficerPriorityLabel(complaint.category);
      const rowStatus = String(complaint.status || "").toLowerCase() === "pending" ? "new" : "pending";
      const hasAssignment = Boolean(getOfficerAssignmentByComplaintId(complaint.id));
      return `
        <tr data-category="${category}" data-status="${rowStatus}">
          <td>#${complaint.id}</td>
          <td>${complaint.title}</td>
          <td><span class="category-badge ${getOfficerCategoryClass(complaint.category)}">${complaint.category || "Other"}</span></td>
          <td>${complaint.location || "N/A"}</td>
          <td>${toShortDate(complaint.date)}</td>
          <td><span class="priority-badge ${priorityClass}">${priorityLabel}</span></td>
          <td>
            <button class="action-btn btn-view" onclick="viewComplaint('${complaint.id}')">View</button>
            <button class="action-btn btn-primary" onclick="assignWorker('${complaint.id}')">${hasAssignment ? "Reassign" : "Assign"}</button>
            <button class="action-btn btn-reject" onclick="verifyResolution('${complaint.id}', false)">Reject</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderVerifyResolutionComplaints() {
  const body = document.getElementById("verifyResolutionRows");
  if (!body) {
    return;
  }

  const complaintsById = new Map(getOfficerScopedComplaints().map((entry) => [entry.id, entry]));
  const verificationAssignments = getOfficerScopedAssignments().filter(
    (entry) =>
      entry.status === "Completed" &&
      complaintsById.has(entry.complaintId) &&
      complaintsById.get(entry.complaintId)?.status !== "resolved",
  );

  if (verificationAssignments.length === 0) {
    body.innerHTML = '<tr><td colspan="8">No completed assignments pending verification.</td></tr>';
    return;
  }

  body.innerHTML = verificationAssignments
    .map((assignment) => {
      const complaint = complaintsById.get(assignment.complaintId);
      const priorityClass = getOfficerPriorityClass(complaint?.category);
      const priorityLabel = getOfficerPriorityLabel(complaint?.category);
      return `
        <tr>
          <td>#${complaint?.id || assignment.complaintId}</td>
          <td>${complaint?.title || assignment.issueDescription || "Complaint"}</td>
          <td><span class="category-badge ${getOfficerCategoryClass(complaint?.category)}">${complaint?.category || assignment.category || "Other"}</span></td>
          <td>${complaint?.location || assignment.location || "N/A"}</td>
          <td>${toShortDate(complaint?.date || assignment.assignedDate)}</td>
          <td><span class="priority-badge ${priorityClass}">${priorityLabel}</span></td>
          <td>${assignment.assignee || "Unassigned"}</td>
          <td>
            <button class="action-btn btn-view" onclick="viewComplaint('${complaint?.id || assignment.complaintId}')">View</button>
            <button class="action-btn btn-success" onclick="verifyResolution('${complaint?.id || assignment.complaintId}', true)">Verify</button>
            <button class="action-btn btn-reject" onclick="verifyResolution('${complaint?.id || assignment.complaintId}', false)">Reject</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderReopenedComplaints() {
  const body = document.getElementById("reopenedIssuesRows");
  if (!body) {
    return;
  }

  const complaints = getOfficerScopedComplaints().filter((entry) => entry.status === "reopened");

  if (complaints.length === 0) {
    body.innerHTML = '<tr><td colspan="7">No reopened complaints at the moment.</td></tr>';
    return;
  }

  body.innerHTML = complaints
    .map((complaint) => {
      const assignment = getOfficerAssignmentByComplaintId(complaint.id);
      const priorityClass = getOfficerPriorityClass(complaint.category);
      const priorityLabel = getOfficerPriorityLabel(complaint.category);
      return `
        <tr>
          <td>#${complaint.id}</td>
          <td>${complaint.title}</td>
          <td><span class="category-badge ${getOfficerCategoryClass(complaint.category)}">${complaint.category || "Other"}</span></td>
          <td>${complaint.location || "N/A"}</td>
          <td><span class="priority-badge ${priorityClass}">${priorityLabel}</span></td>
          <td>${assignment?.assignee || "Unassigned"}</td>
          <td>
            <button class="action-btn btn-view" onclick="viewComplaint('${complaint.id}')">View</button>
            <button class="action-btn btn-reassign" onclick="assignWorker('${complaint.id}')">Reassign</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function refreshOfficerComplaintViews() {
  renderOfficerDashboardComplaints();
  renderValidateAssignComplaints();
  renderVerifyResolutionComplaints();
  renderReopenedComplaints();
  renderOfficerWorkerTable();
  renderAssignWorkerOptions();
  applyValidateAssignFilters();
}

function renderOfficerDashboardComplaints() {
  const rows = document.getElementById("dashboardComplaintsRows");
  if (!rows) {
    return;
  }

  const complaints = getOfficerScopedComplaints();
  const topComplaints = complaints.slice(0, 5);

  if (topComplaints.length === 0) {
    rows.innerHTML = '<tr><td colspan="7">No complaints available.</td></tr>';
  } else {
    rows.innerHTML = topComplaints
      .map((complaint) => {
        const idNumeric = complaint.id.replace("CMP-", "");
        return `
          <tr>
            <td>#${idNumeric}</td>
            <td>${complaint.title}</td>
            <td><span class="category-badge ${getOfficerCategoryClass(complaint.category)}">${complaint.category}</span></td>
            <td><span class="priority-badge ${getOfficerPriorityClass(complaint.category)}">${getOfficerPriorityClass(complaint.category) === "priority-high" ? "High" : "Medium"}</span></td>
            <td><span class="status-badge ${getOfficerStatusClass(complaint.status)}">${complaint.status}</span></td>
            <td>${complaint.reportedBy || "Citizen"}</td>
            <td>${toShortDate(complaint.date)}</td>
          </tr>
        `;
      })
      .join("");
  }

  const stats = document.querySelectorAll("#dashboard .stat-value");
  if (stats.length >= 4) {
    const pending = complaints.filter((entry) => entry.status === "pending").length;
    const inProgress = complaints.filter((entry) => entry.status === "in-progress").length;
    const resolved = complaints.filter((entry) => entry.status === "resolved").length;
    const reopened = complaints.filter((entry) => entry.status === "reopened").length;

    stats[0].textContent = String(pending);
    stats[1].textContent = String(inProgress);
    stats[2].textContent = String(resolved);
    stats[3].textContent = String(reopened);
  }
}

const OFFICER_PAGE_STATE_KEY = "urbanity.deptofficer.lastPage";
const OFFICER_ALLOWED_PAGES = [
  "dashboard",
  "validate-assign",
  "verify-resolution",
  "reopened-issues",
  "field-workers",
  "profile",
];

const OFFICER_DEFAULT_PERMISSIONS = {
  complaints: ["read", "update"],
  profile: ["read", "update"],
};

const OFFICER_PAGE_ACCESS = {
  dashboard: { module: "complaints", action: "read" },
  "validate-assign": { module: "complaints", action: "update" },
  "verify-resolution": { module: "complaints", action: "update" },
  "reopened-issues": { module: "complaints", action: "read" },
  "field-workers": { module: "complaints", action: "read" },
  profile: { module: "profile", action: "read" },
};

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
const officerPermissions = roleContext.permissions || OFFICER_DEFAULT_PERMISSIONS;

if (
  roleContext.role !== "department_officer" &&
  roleContext.role !== "domain_admin_dept_head" &&
  roleContext.role !== "super_user_admin"
) {
  showOfficerToast(
    "Access denied: This portal is only for Department Officer role. Redirecting to sign in.",
    "error",
  );
  window.setTimeout(() => {
    window.location.href = "../Authentication/auth.html";
  }, 900);
}

applySessionUserToOfficer();

function persistOfficerPage(pageName) {
  sessionStorage.setItem(OFFICER_PAGE_STATE_KEY, pageName);
}

function hasPermission(moduleName, action) {
  const wildcard = officerPermissions["*"] || [];
  const moduleAccess = officerPermissions[moduleName] || [];
  return wildcard.includes(action) || moduleAccess.includes(action);
}

function hasPageAccess(pageName) {
  if (!OFFICER_ALLOWED_PAGES.includes(pageName)) {
    return false;
  }

  const config = OFFICER_PAGE_ACCESS[pageName];
  if (!config) {
    return false;
  }

  return hasPermission(config.module, config.action);
}

function getFirstAccessibleOfficerPage() {
  const first = OFFICER_ALLOWED_PAGES.find((pageName) => hasPageAccess(pageName));
  return first || "dashboard";
}

function applyOfficerRoleRendering() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const page = link.getAttribute("data-page");
    link.parentElement.style.display = hasPageAccess(page) ? "" : "none";
  });
}

function getSavedOfficerPage() {
  const saved = sessionStorage.getItem(OFFICER_PAGE_STATE_KEY);
  if (!saved) {
    return getFirstAccessibleOfficerPage();
  }

  return hasPageAccess(saved) ? saved : getFirstAccessibleOfficerPage();
}

function signOut() {
  sessionStorage.removeItem("urbanityRoleContext");
  sessionStorage.removeItem("urbanityRole");
  sessionStorage.removeItem("urbanityRoleLabel");
  sessionStorage.removeItem("urbanityCurrentUser");
  sessionStorage.removeItem(OFFICER_PAGE_STATE_KEY);
  window.location.href = "../Landing Page/landingpage.html";
}

// Notification data
const notifications = [
  {
    id: 1,
    title: "New Complaint Assigned",
    message: "Complaint #1245 has been submitted and needs validation.",
    time: "5 min ago",
    unread: true,
  },
  {
    id: 2,
    title: "Resolution Verified",
    message: "Worker A completed task for complaint #1230.",
    time: "1 hour ago",
    unread: true,
  },
  {
    id: 3,
    title: "Complaint Reopened",
    message: "Complaint #1220 has been reopened by citizen.",
    time: "2 hours ago",
    unread: true,
  },
  {
    id: 4,
    title: "Worker Assigned",
    message: "Worker B has been assigned to complaint #1235.",
    time: "3 hours ago",
    unread: false,
  },
];

// Initialize notifications
function initNotifications() {
  const notificationList = document.getElementById("notificationList");
  const unreadCount = notifications.filter((n) => n.unread).length;

  document.getElementById("notificationBadge").textContent = unreadCount;
  document.getElementById("unreadCount").textContent = unreadCount;

  notificationList.innerHTML = notifications
    .map(
      (notification) => `
        <div class="notification-item ${notification.unread ? "unread" : ""}">
          <div class="notification-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <div class="notification-content">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              ${notification.time}
            </div>
          </div>
        </div>
      `,
    )
    .join("");
}

// Navigation
function navigateTo(pageName) {
  if (!hasPageAccess(pageName)) {
    return;
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
  });

  const pageElement = document.getElementById(pageName);
  const navElement = document.querySelector(`[data-page="${pageName}"]`);
  if (pageElement) {
    pageElement.classList.add("active");
  }
  if (navElement) {
    navElement.classList.add("active");
  }

  persistOfficerPage(pageName);
}

// Event listeners for navigation
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", function (e) {
    e.preventDefault();
    const pageName = this.getAttribute("data-page");
    navigateTo(pageName);
  });
});

// Notification dropdown
document
  .getElementById("notificationBtn")
  .addEventListener("click", function (e) {
    e.stopPropagation();
    const dropdown = document.getElementById("notificationDropdown");
    const profileDropdown = document.getElementById("profileDropdown");
    dropdown.classList.toggle("show");
    profileDropdown.classList.remove("show");
  });

// Profile dropdown
document.getElementById("userInfoBtn").addEventListener("click", function (e) {
  e.stopPropagation();
  const dropdown = document.getElementById("profileDropdown");
  const notificationDropdown = document.getElementById("notificationDropdown");
  dropdown.classList.toggle("show");
  notificationDropdown.classList.remove("show");
});

// View profile button
document
  .getElementById("viewProfileBtn")
  .addEventListener("click", function () {
    document.getElementById("profileDropdown").classList.remove("show");
    navigateTo("profile");
  });

// Close dropdowns when clicking outside
document.addEventListener("click", function () {
  document.querySelectorAll(".dropdown-menu").forEach((menu) => {
    menu.classList.remove("show");
  });
});

// Modal functions
function openModal(modalId) {
  document.getElementById(modalId).classList.add("show");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("show");
}

function normalizeOfficerMediaList(mediaList) {
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

function renderOfficerMediaPreview(mediaList, emptyText) {
  const media = normalizeOfficerMediaList(mediaList);
  if (media.length === 0) {
    return `<span>${emptyText}</span>`;
  }

  return `
    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap:10px;">
      ${media
        .map((item) => {
          const isVideo = item.type === "video";
          return `
            <a href="${item.url}" target="_blank" rel="noopener" style="display:block; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; background:#fff; text-decoration:none;">
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

function viewComplaint(id) {
  const complaintId = String(id).startsWith("CMP-") ? String(id) : `CMP-${id}`;
  const complaints = getOfficerScopedComplaints();
  const complaint =
    complaints.find((entry) => entry.id === complaintId) ||
    getStoreComplaints().find((entry) => entry.id === complaintId);

  if (!complaint) {
    showOfficerToast("Unable to find complaint details.", "error");
    return;
  }

  const assignment = getOfficerAssignmentByComplaintId(complaint.id);
  const users = getStoreUsers();
  const citizenUser =
    users.find((user) => user.id === complaint.reportedById) ||
    users.find(
      (user) =>
        String(user.email || "").toLowerCase() === String(complaint.reportedByEmail || "").toLowerCase(),
    ) ||
    users.find((user) => user.name === complaint.reportedBy);

  const assignmentText = assignment
    ? `${assignment.assignee || "Unassigned"} (${assignment.status || "Pending"})`
    : "Not assigned yet";

  const category = complaint.category || "Other";
  const categoryClass = getOfficerCategoryClass(category);
  const priorityClass = getOfficerPriorityClass(category);
  const priorityLabel = getOfficerPriorityLabel(category);

  document.getElementById("modalComplaintId").textContent = `#${complaint.id}`;
  document.getElementById("modalComplaintDate").textContent = toShortDate(complaint.date);
  document.getElementById(
    "modalComplaintCategory",
  ).innerHTML = `<span class="category-badge ${categoryClass}">${category}</span>`;
  document.getElementById(
    "modalComplaintPriority",
  ).innerHTML = `<span class="priority-badge ${priorityClass}">${priorityLabel}</span>`;
  document.getElementById("modalComplaintTitle").textContent = complaint.title || "N/A";
  document.getElementById("modalComplaintDescription").textContent =
    complaint.description || "No description provided.";
  document.getElementById("modalComplaintLocation").textContent = complaint.location || "N/A";
  document.getElementById("modalCitizenName").textContent =
    complaint.reportedBy || citizenUser?.name || "Citizen";
  document.getElementById("modalCitizenContact").textContent =
    citizenUser?.phone || complaint.reportedByEmail || "N/A";
  document.getElementById("modalAssignmentInfo").textContent = assignmentText;
  document.getElementById("modalComplaintMedia").innerHTML = renderOfficerMediaPreview(
    complaint.media,
    "No media attached.",
  );
  document.getElementById("modalResolutionMedia").innerHTML = renderOfficerMediaPreview(
    complaint.resolutionMedia && complaint.resolutionMedia.length
      ? complaint.resolutionMedia
      : assignment?.proofMedia,
    "No proof uploaded.",
  );

  openModal("complaintModal");
}

let selectedWorker = null;
let selectedComplaintId = null;

function assignWorker(complaintId) {
  selectedComplaintId = complaintId;
  selectedWorker = null;
  renderAssignWorkerOptions();
  document.querySelectorAll(".worker-item").forEach((item) => {
    item.classList.remove("selected");
  });
  openModal("assignWorkerModal");
}

function selectWorker(element, workerId, workerName) {
  document.querySelectorAll(".worker-item").forEach((item) => {
    item.classList.remove("selected");
  });
  element.classList.add("selected");
  selectedWorker = {
    id: workerId,
    name: workerName,
  };
}

function confirmAssignment() {
  if (selectedWorker) {
    const { officer, head } = getOfficerHierarchy();
    const complaintId = String(selectedComplaintId || "");
    const complaint = getStoreComplaints().find((entry) => entry.id === complaintId);
    const existingAssignment = getOfficerAssignmentByComplaintId(complaintId);

    if (!complaint) {
      showOfficerToast("Unable to find this complaint in the shared data store.", "error");
      return;
    }

    if (window.MockDataAPI) {
      const assignmentPayload = {
        complaintId,
        issueDescription: complaint.title,
        category: complaint.category || "Other",
        location: complaint.location || "N/A",
        assignedDate: new Date().toLocaleDateString(),
        priority: getOfficerPriorityLabel(complaint.category),
        status: "Pending",
        details: complaint.description || "Assigned by Department Officer for field resolution.",
        citizenName: complaint.reportedBy || "Citizen",
        citizenContact: complaint.reportedByEmail || "N/A",
        assignee: selectedWorker.name,
        assigneeId: selectedWorker.id,
        officerId: officer?.id,
        headId: head?.id || officer?.headId,
      };

      if (existingAssignment) {
        window.MockDataAPI.update("assignments", existingAssignment.id, assignmentPayload);
      } else {
        window.MockDataAPI.add("assignments", {
          id: `ASG-${Date.now().toString().slice(-6)}`,
          ...assignmentPayload,
        });
      }

      window.MockDataAPI.update("complaints", complaintId, {
        status: "in-progress",
      });
    }

    refreshOfficerComplaintViews();
    showOfficerToast(`Complaint ${complaintId} assigned to ${selectedWorker.name}.`, "success");
    closeModal("assignWorkerModal");
  } else {
    showOfficerToast("Please select a worker first.", "error");
  }
}

function verifyResolution(id, approved) {
  const complaintId = String(id).startsWith("CMP-") ? String(id) : `CMP-${id}`;

  if (!window.MockDataAPI) {
    return;
  }

  const assignment = getOfficerAssignmentByComplaintId(complaintId);
  if (assignment) {
    window.MockDataAPI.update("assignments", assignment.id, {
      status: approved ? "Completed" : "Rejected",
      verifiedAt: new Date().toLocaleString(),
    });
  }

  window.MockDataAPI.update("complaints", complaintId, {
    status: approved ? "resolved" : "reopened",
    verifiedAt: new Date().toLocaleString(),
  });

  refreshOfficerComplaintViews();
  showOfficerToast(
    `Complaint ${complaintId} has been ${approved ? "verified and resolved" : "reopened"}.`,
    "success",
  );
}

function applyValidateAssignFilters() {
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const rows = document.querySelectorAll("#validateAssignRows tr");
  if (!categoryFilter || !statusFilter || rows.length === 0) return;

  const selectedCategory = categoryFilter.value;
  const selectedStatus = statusFilter.value;

  rows.forEach((row) => {
    const category = row.dataset.category || "";
    const status = row.dataset.status || "";

    const categoryMatch = selectedCategory === "all" || category === selectedCategory;
    const statusMatch = selectedStatus === "all" || status === selectedStatus;
    row.style.display = categoryMatch && statusMatch ? "" : "none";
  });
}

function initValidateAssignFilters() {
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  if (!categoryFilter || !statusFilter) return;

  categoryFilter.addEventListener("change", applyValidateAssignFilters);
  statusFilter.addEventListener("change", applyValidateAssignFilters);
  applyValidateAssignFilters();
}

// Edit Profile functions
function openEditProfile() {
  document.getElementById("editName").value = profileData.name;
  document.getElementById("editEmail").value = profileData.email;
  document.getElementById("editPhone").value = profileData.phone;
  document.getElementById("editLocation").value = profileData.location;
  setOfficerFormMessage("editProfileForm", "");
  openModal("editProfileModal");
}

function saveProfile() {
  if (!hasPermission("profile", "update")) {
    setOfficerFormMessage("editProfileForm", "You do not have permission to update profile details.");
    return;
  }

  const name = (document.getElementById("editName").value || "").trim();
  const email = (document.getElementById("editEmail").value || "").trim().toLowerCase();
  const phone = (document.getElementById("editPhone").value || "").trim();
  const location = (document.getElementById("editLocation").value || "").trim();

  if (!name || !email || !phone || !location) {
    setOfficerFormMessage("editProfileForm", "Please complete all profile fields.");
    return;
  }

  if (!OFFICER_EMAIL_REGEX.test(email)) {
    setOfficerFormMessage("editProfileForm", "Enter a valid email address.");
    return;
  }

  if (!OFFICER_PHONE_REGEX.test(phone)) {
    setOfficerFormMessage("editProfileForm", "Enter a valid phone number.");
    return;
  }

  profileData.name = name;
  profileData.email = email;
  profileData.phone = phone;
  profileData.location = location;

  // Update profile page
  document.getElementById("profileName").textContent = profileData.name;
  document.getElementById("infoName").textContent = profileData.name;
  document.getElementById("infoEmail").textContent = profileData.email;
  document.getElementById("infoPhone").textContent = profileData.phone;
  document.getElementById("infoLocation").textContent = profileData.location;

  // Update header
  document.querySelector(".user-name").textContent = profileData.name;
  document.querySelector(".user-email").textContent = profileData.email;

  setOfficerFormMessage("editProfileForm", "Profile updated successfully.", "success");
  closeModal("editProfileModal");
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  initNotifications();
  initValidateAssignFilters();
  applyOfficerRoleRendering();
  refreshOfficerComplaintViews();

  document.querySelector(".sign-out-btn")?.addEventListener("click", signOut);
  document.querySelector(".profile-sign-out")?.addEventListener("click", signOut);
  document.getElementById("editProfileForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveProfile();
  });

  navigateTo(getSavedOfficerPage());
});
