// Navigation handling
let profileData = {
  name: "Officer Smith",
  email: "officer@urbanity.gov",
  phone: "+1-234-567-8900",
  location: "District Office, Block A",
};

const HEAD_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEAD_PHONE_REGEX = /^\+?[0-9()\-\s]{8,20}$/;

function setDeptHeadFormMessage(formId, text, type = "error") {
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

function applySessionUserToDeptHead() {
  const currentUser = getCurrentSessionUser();
  if (!currentUser) {
    return;
  }

  profileData.name = currentUser.name || profileData.name;
  profileData.email = currentUser.email || profileData.email;

  const initials = profileData.name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatarName = document.querySelector(".avatar-name");
  const avatarEmail = document.querySelector(".avatar-email");
  const avatarText = document.querySelector(".avatar-text");
  const profileName = document.getElementById("profileName");
  const infoName = document.getElementById("infoName");
  const infoEmail = document.getElementById("infoEmail");
  const profileAvatarLarge = document.querySelector(".profile-avatar-large");

  if (avatarName) avatarName.textContent = profileData.name;
  if (avatarEmail) avatarEmail.textContent = profileData.email;
  if (avatarText) avatarText.textContent = initials;
  if (profileName) profileName.textContent = profileData.name;
  if (infoName) infoName.textContent = profileData.name;
  if (infoEmail) infoEmail.textContent = profileData.email;
  if (profileAvatarLarge) profileAvatarLarge.textContent = initials;
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

function getCurrentDeptHeadRecord() {
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

function getHeadScopedUsers() {
  const users = getStoreUsers();
  const currentHead = getCurrentDeptHeadRecord();

  const officers = users.filter((user) => user.role === "Department Officer");
  const workers = users.filter((user) => user.role === "Field Worker");

  if (roleContext.role === "super_user_admin") {
    return {
      currentHead,
      officers,
      workers,
    };
  }

  if (!currentHead || !currentHead.id) {
    return {
      currentHead,
      officers: [],
      workers: [],
    };
  }

  const managedOfficers = officers.filter((user) => user.headId === currentHead.id);
  const managedOfficerIds = new Set(managedOfficers.map((user) => user.id));
  const managedWorkers = workers.filter(
    (user) => user.headId === currentHead.id || managedOfficerIds.has(user.officerId),
  );

  return {
    currentHead,
    officers: managedOfficers,
    workers: managedWorkers,
  };
}

function getHeadScopedComplaints() {
  const complaints = getStoreComplaints();
  const assignments = getStoreAssignments();
  const { currentHead, officers, workers } = getHeadScopedUsers();

  if (roleContext.role === "super_user_admin") {
    return complaints;
  }

  if (!currentHead || !currentHead.id) {
    return [];
  }

  const workerIdSet = new Set(workers.map((worker) => worker.id));
  const scopedComplaintIds = new Set(
    assignments
      .filter(
        (entry) =>
          entry.headId === currentHead.id ||
          workerIdSet.has(entry.assigneeId),
      )
      .map((entry) => entry.complaintId),
  );

  const managedDepartments = new Set(officers.map((officer) => officer.department));
  managedDepartments.add(currentHead.department);
  complaints
    .filter((entry) => managedDepartments.has(entry.department))
    .forEach((entry) => scopedComplaintIds.add(entry.id));

  const scoped = complaints.filter((entry) => scopedComplaintIds.has(entry.id));
  if (scoped.length === 0) {
    return complaints;
  }

  return scoped.sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

function getHeadStatusChip(status) {
  const normalized = (status || "pending").toLowerCase();
  const allowed = new Set(["pending", "in-progress", "resolved", "escalated"]);
  const statusName = allowed.has(normalized) ? normalized : "pending";
  return `chip chip-status-${statusName}`;
}

function getHeadPriorityChip(priority) {
  const normalized = (priority || "medium").toLowerCase();
  if (normalized === "high") return "chip chip-priority-high";
  if (normalized === "low") return "chip chip-priority-low";
  return "chip chip-priority-medium";
}

function derivePriorityFromCategory(category) {
  const highCategories = ["infrastructure", "roads", "water", "public safety"];
  return highCategories.includes((category || "").toLowerCase()) ? "high" : "medium";
}

function findAssigneeForComplaint(complaintId) {
  const assignment = getStoreAssignments().find((entry) => entry.complaintId === complaintId);
  return assignment?.assignee || "Unassigned";
}

function toHeadDate(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString();
  }
  return value || "N/A";
}

function toHeadMediaList(mediaList) {
  if (!Array.isArray(mediaList)) {
    return [];
  }

  return mediaList.filter((item) => item && item.url);
}

function renderHeadMediaLinks(complaint, assignmentByComplaintId) {
  const assignment = assignmentByComplaintId.get(complaint.id);
  const complaintMedia = toHeadMediaList(complaint.media);
  const resolutionMedia = toHeadMediaList(
    complaint.resolutionMedia && complaint.resolutionMedia.length
      ? complaint.resolutionMedia
      : assignment?.proofMedia,
  );

  if (complaintMedia.length === 0 && resolutionMedia.length === 0) {
    return "";
  }

  const complaintLinks = complaintMedia
    .map((item, idx) => `<a href="${item.url}" target="_blank" rel="noopener">Complaint ${idx + 1}</a>`)
    .join(" | ");
  const resolutionLinks = resolutionMedia
    .map((item, idx) => `<a href="${item.url}" target="_blank" rel="noopener">Proof ${idx + 1}</a>`)
    .join(" | ");

  return `
    <div style="margin-top: 4px; font-size: 12px; color: #64748b;">
      ${complaintLinks ? `<div>${complaintLinks}</div>` : ""}
      ${resolutionLinks ? `<div>${resolutionLinks}</div>` : ""}
    </div>
  `;
}

function renderHeadDashboardComplaintTables() {
  const complaints = getHeadScopedComplaints();
  const assignments = getStoreAssignments();
  const assignmentByComplaintId = new Map(assignments.map((item) => [item.complaintId, item]));
  const escalatedRows = document.getElementById("headDashboardEscalatedRows");
  const complaintsRows = document.getElementById("headDashboardComplaintsRows");
  const allComplaintsRows = document.getElementById("headAllComplaintsRows");
  const allEscalatedRows = document.getElementById("headAllEscalatedRows");

  const escalated = complaints
    .filter((entry) => entry.status === "escalated" || Number(entry.upvotes || 0) >= 20)
    .slice(0, 5);

  if (escalatedRows) {
    escalatedRows.innerHTML =
      escalated.length === 0
        ? '<tr><td colspan="8">No escalated issues available.</td></tr>'
        : escalated
            .map((complaint) => {
              const priority = derivePriorityFromCategory(complaint.category);
              return `
                <tr>
                  <td>${complaint.id}</td>
                  <td>${complaint.title}${renderHeadMediaLinks(complaint, assignmentByComplaintId)}</td>
                  <td>${complaint.category}</td>
                  <td><span class="${getHeadStatusChip("escalated")}">escalated</span></td>
                  <td><span class="${getHeadPriorityChip(priority)}">${priority}</span></td>
                  <td>${complaint.reportedBy || "Citizen"}</td>
                  <td>${toHeadDate(complaint.date)}</td>
                  <td>${findAssigneeForComplaint(complaint.id)}</td>
                </tr>
              `;
            })
            .join("");
  }

  if (complaintsRows) {
    complaintsRows.innerHTML =
      complaints.length === 0
        ? '<tr><td colspan="8">No complaints available.</td></tr>'
        : complaints.slice(0, 6)
            .map((complaint) => {
              const priority = derivePriorityFromCategory(complaint.category);
              return `
                <tr>
                  <td>${complaint.id}</td>
                  <td>${complaint.title}${renderHeadMediaLinks(complaint, assignmentByComplaintId)}</td>
                  <td>${complaint.category}</td>
                  <td><span class="${getHeadStatusChip(complaint.status)}">${complaint.status}</span></td>
                  <td><span class="${getHeadPriorityChip(priority)}">${priority}</span></td>
                  <td>${complaint.reportedBy || "Citizen"}</td>
                  <td>${toHeadDate(complaint.date)}</td>
                  <td>${findAssigneeForComplaint(complaint.id)}</td>
                </tr>
              `;
            })
            .join("");
  }

  if (allComplaintsRows) {
    allComplaintsRows.innerHTML =
      complaints.length === 0
        ? '<tr><td colspan="8">No complaints available.</td></tr>'
        : complaints
            .map((complaint) => {
              const priority = derivePriorityFromCategory(complaint.category);
              return `
                <tr>
                  <td>${complaint.id}</td>
                  <td>${complaint.title}${renderHeadMediaLinks(complaint, assignmentByComplaintId)}</td>
                  <td>${complaint.category}</td>
                  <td><span class="${getHeadStatusChip(complaint.status)}">${complaint.status}</span></td>
                  <td><span class="${getHeadPriorityChip(priority)}">${priority}</span></td>
                  <td>${complaint.reportedBy || "Citizen"}</td>
                  <td>${toHeadDate(complaint.date)}</td>
                  <td>${findAssigneeForComplaint(complaint.id)}</td>
                </tr>
              `;
            })
            .join("");
  }

  if (allEscalatedRows) {
    allEscalatedRows.innerHTML =
      escalated.length === 0
        ? '<tr><td colspan="8">No escalated issues available.</td></tr>'
        : escalated
            .map((complaint) => {
              const priority = derivePriorityFromCategory(complaint.category);
              return `
                <tr>
                  <td>${complaint.id}</td>
                  <td>${complaint.title}${renderHeadMediaLinks(complaint, assignmentByComplaintId)}</td>
                  <td>${complaint.category}</td>
                  <td><span class="${getHeadStatusChip("escalated")}">escalated</span></td>
                  <td><span class="${getHeadPriorityChip(priority)}">${priority}</span></td>
                  <td>${complaint.reportedBy || "Citizen"}</td>
                  <td>${toHeadDate(complaint.date)}</td>
                  <td>${findAssigneeForComplaint(complaint.id)}</td>
                </tr>
              `;
            })
            .join("");
  }

  const dashboardStats = document.querySelectorAll("#dashboard-page .stat-value");
  if (dashboardStats.length >= 2) {
    dashboardStats[0].textContent = String(complaints.length);
    dashboardStats[1].textContent = String(escalated.length);
  }
}

function renderDeptHeadHierarchyTables() {
  const { officers, workers } = getHeadScopedUsers();
  const assignments = getStoreAssignments();
  const workerMap = new Map(workers.map((worker) => [worker.id, worker]));

  const officerTaskCount = new Map();
  assignments.forEach((assignment) => {
    const ownerOfficerId = assignment.officerId || workerMap.get(assignment.assigneeId)?.officerId;
    if (!ownerOfficerId) {
      return;
    }
    officerTaskCount.set(ownerOfficerId, (officerTaskCount.get(ownerOfficerId) || 0) + 1);
  });

  const officerBody = document.querySelector("#department-officers-page tbody");
  if (officerBody) {
    if (officers.length === 0) {
      officerBody.innerHTML = '<tr><td colspan="7">No department officers mapped to this head.</td></tr>';
    } else {
      officerBody.innerHTML = officers
        .map((officer, index) => {
          const taskCount = officerTaskCount.get(officer.id) || 0;
          return `
            <tr>
              <td>OFF-${String(index + 1).padStart(3, "0")}</td>
              <td>${officer.name}</td>
              <td>Department Officer</td>
              <td>${officer.department}</td>
              <td class="contact-cell">
                <div class="contact-line">mail: ${officer.email}</div>
                <div class="contact-line">tel: ${officer.phone || "N/A"}</div>
              </td>
              <td><span class="chip chip-status-active">active</span></td>
              <td>${taskCount}</td>
            </tr>
          `;
        })
        .join("");
    }
  }

  const workerBody = document.querySelector("#field-workers-page tbody");
  if (workerBody) {
    if (workers.length === 0) {
      workerBody.innerHTML = '<tr><td colspan="8">No field workers mapped to this head.</td></tr>';
    } else {
      workerBody.innerHTML = workers
        .map((worker, index) => {
          const assigned = assignments.filter(
            (entry) => entry.assigneeId === worker.id || entry.assignee === worker.name,
          );
          const completed = assigned.filter((entry) => entry.status === "Completed").length;
          const location = `${worker.department} Zone`;
          return `
            <tr>
              <td>WRK-${String(index + 1).padStart(3, "0")}</td>
              <td>${worker.name}</td>
              <td>Field Worker</td>
              <td>${worker.department}</td>
              <td class="contact-cell">
                <div class="contact-line">mail: ${worker.email}</div>
                <div class="contact-line">tel: ${worker.phone || "N/A"}</div>
              </td>
              <td><span class="chip chip-status-active">active</span></td>
              <td>${assigned.length}</td>
              <td class="location-cell">${location}</td>
            </tr>
          `;
        })
        .join("");
    }
  }

  const fieldWorkerStats = document.querySelectorAll("#field-workers-page .stat-value");
  if (fieldWorkerStats.length >= 3) {
    const activeWorkers = workers.length;
    const totalAssigned = assignments.filter(
      (entry) => workers.some((worker) => entry.assigneeId === worker.id || entry.assignee === worker.name),
    ).length;
    const completed = assignments.filter(
      (entry) =>
        entry.status === "Completed" &&
        workers.some((worker) => entry.assigneeId === worker.id || entry.assignee === worker.name),
    ).length;

    fieldWorkerStats[0].textContent = String(activeWorkers);
    fieldWorkerStats[1].textContent = String(totalAssigned);
    fieldWorkerStats[2].textContent = String(completed);
  }

  const dashboardStats = document.querySelectorAll("#dashboard-page .stat-value");
  if (dashboardStats.length >= 4) {
    dashboardStats[2].textContent = String(officers.length);
    dashboardStats[3].textContent = String(workers.length);
  }

  renderHeadDashboardComplaintTables();
}

const DEPT_HEAD_PERMISSIONS = {
  dashboard: ["read"],
  complaints: ["create", "read", "update"],
  "escalated-issues": ["create", "read", "update"],
  "department-officers": ["create", "read", "update"],
  "field-workers": ["create", "read", "update"],
  profile: ["read", "update"],
};

const DEPT_HEAD_PAGE_STATE_KEY = "urbanity.depthead.lastPage";

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
const rolePermissions = roleContext.permissions || DEPT_HEAD_PERMISSIONS;

function showDeptHeadToast(message, type = "info") {
  if (window.UIFeedback?.toast) {
    window.UIFeedback.toast({ scope: "depthead", message, type });
    return;
  }
  console[type === "error" ? "error" : "log"](message);
}

if (
  roleContext.role !== "domain_admin_dept_head" &&
  roleContext.role !== "super_user_admin"
) {
  showDeptHeadToast(
    "Access denied: This portal is for Admin (Department Head). Redirecting to sign in.",
    "error",
  );
  window.setTimeout(() => {
    window.location.href = "../Authentication/auth.html";
  }, 900);
}

applySessionUserToDeptHead();

function hasPermission(moduleName, action) {
  if (roleContext.role === "super_user_admin") {
    return true;
  }

  const moduleAccess = rolePermissions[moduleName] || [];
  return moduleAccess.includes(action);
}

function guardRestrictedActions() {
  if (roleContext.role === "super_user_admin") {
    return;
  }

  document.querySelectorAll("[data-rbac-action]").forEach((element) => {
    const requiredAction = element.dataset.rbacAction;
    const moduleName = element.dataset.rbacModule;
    if (!hasPermission(moduleName, requiredAction)) {
      element.disabled = true;
      element.style.opacity = "0.5";
      element.style.cursor = "not-allowed";
      element.title = "Not allowed for Admin (Department Head)";
    }
  });
}

function signOut() {
  sessionStorage.removeItem("urbanityRoleContext");
  sessionStorage.removeItem("urbanityRole");
  sessionStorage.removeItem("urbanityRoleLabel");
  sessionStorage.removeItem("urbanityCurrentUser");
  sessionStorage.removeItem(DEPT_HEAD_PAGE_STATE_KEY);
  window.location.href = "../Landing Page/landingpage.html";
}

function persistDeptHeadPage(pageName) {
  sessionStorage.setItem(DEPT_HEAD_PAGE_STATE_KEY, pageName);
}

function getSavedDeptHeadPage() {
  const saved = sessionStorage.getItem(DEPT_HEAD_PAGE_STATE_KEY);
  if (!saved || !pages[saved]) {
    return "dashboard";
  }
  return saved;
}

const navButtons = document.querySelectorAll(".nav-button");
const pages = {
  dashboard: document.getElementById("dashboard-page"),
  complaints: document.getElementById("complaints-page"),
  "escalated-issues": document.getElementById("escalated-issues-page"),
  "department-officers": document.getElementById("department-officers-page"),
  "field-workers": document.getElementById("field-workers-page"),
  profile: document.getElementById("profile-page"),
};

const pageTitles = {
  dashboard: "Department Head Portal",
  complaints: "Complaints",
  "escalated-issues": "Escalated Issues",
  "department-officers": "Department Officers",
  "field-workers": "Field Workers",
  profile: "Profile",
};

const notifications = [
  {
    id: 1,
    title: "New Escalated Issue",
    message: "Major road collapse requires immediate attention.",
    time: "5 min ago",
    unread: true,
  },
  {
    id: 2,
    title: "Case Resolved",
    message: "Pothole repair on Elm Street has been completed.",
    time: "1 hour ago",
    unread: true,
  },
  {
    id: 3,
    title: "New Assignment",
    message: "Officer Johnson assigned to case #C-1235.",
    time: "2 hours ago",
    unread: true,
  },
  {
    id: 4,
    title: "Field Update",
    message: "Worker team submitted completion photos for review.",
    time: "3 hours ago",
    unread: false,
  },
];

function navigateTo(pageName) {
  if (!hasPermission(pageName, "read")) {
    showDeptHeadToast("You do not have access to this module.", "error");
    return;
  }

  // Hide all pages
  Object.values(pages).forEach((page) => page.classList.add("hidden"));

  // Show selected page
  if (pages[pageName]) {
    pages[pageName].classList.remove("hidden");
  }

  // Update active nav button
  navButtons.forEach((btn) => {
    if (btn.dataset.page === pageName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update page title
  document.getElementById("pageTitle").textContent =
    pageTitles[pageName] || pageName;

  // Close any open dropdowns
  closeAllDropdowns();

  persistDeptHeadPage(pageName);
}

navButtons.forEach((button) => {
  button.addEventListener("click", function () {
    navigateTo(this.dataset.page);
  });
});

// Dropdown and notification handling
const bellButton = document.getElementById("bellButton");
const avatarButton = document.getElementById("avatarButton");
const dropdownMenu = document.getElementById("dropdownMenu");
const notificationPanel = document.getElementById("notificationPanel");

function closeAllDropdowns() {
  dropdownMenu.classList.remove("show");
  notificationPanel.classList.remove("show");
}

function positionDropdown(button, dropdown, matchButtonWidth = true) {
  const rect = button.getBoundingClientRect();
  dropdown.style.top = rect.bottom + 8 + "px";
  dropdown.style.right = window.innerWidth - rect.right + "px";
  if (matchButtonWidth) {
    dropdown.style.width = rect.width + "px";
  } else {
    dropdown.style.width = "";
  }
}

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
            <div class="notification-item-title">${notification.title}</div>
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

bellButton.addEventListener("click", function (e) {
  e.stopPropagation();
  const isOpen = notificationPanel.classList.contains("show");
  closeAllDropdowns();
  if (!isOpen) {
    positionDropdown(bellButton, notificationPanel, false);
    notificationPanel.classList.add("show");
  }
});

avatarButton.addEventListener("click", function (e) {
  e.stopPropagation();
  const isOpen = dropdownMenu.classList.contains("show");
  closeAllDropdowns();
  if (!isOpen) {
    positionDropdown(avatarButton, dropdownMenu);
    dropdownMenu.classList.add("show");
  }
});

// Close dropdowns when clicking outside
document.addEventListener("click", function (e) {
  if (
    !dropdownMenu.contains(e.target) &&
    !notificationPanel.contains(e.target)
  ) {
    closeAllDropdowns();
  }
});

// Dropdown menu actions
const dropdownItems = document.querySelectorAll(".dropdown-item");
dropdownItems.forEach(function (item) {
  item.addEventListener("click", function () {
    const action = this.dataset.action;
    if (action === "profile") {
      navigateTo("profile");
    } else if (action === "signout") {
      signOut();
      return;
    } else {
      showDeptHeadToast(action + " clicked", "info");
    }
    closeAllDropdowns();
  });
});

function openModal(modalId) {
  document.getElementById(modalId).classList.add("show");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("show");
}

function openEditProfile() {
  document.getElementById("editName").value = profileData.name;
  document.getElementById("editEmail").value = profileData.email;
  document.getElementById("editPhone").value = profileData.phone;
  document.getElementById("editLocation").value = profileData.location;
  setDeptHeadFormMessage("editProfileForm", "");
  openModal("editProfileModal");
}

function saveProfile() {
  if (!hasPermission("profile", "update")) {
    setDeptHeadFormMessage("editProfileForm", "You do not have permission to update profile details.");
    return;
  }

  const name = (document.getElementById("editName").value || "").trim();
  const email = (document.getElementById("editEmail").value || "").trim().toLowerCase();
  const phone = (document.getElementById("editPhone").value || "").trim();
  const location = (document.getElementById("editLocation").value || "").trim();

  if (!name || !email || !phone || !location) {
    setDeptHeadFormMessage("editProfileForm", "Please complete all profile fields.");
    return;
  }

  if (!HEAD_EMAIL_REGEX.test(email)) {
    setDeptHeadFormMessage("editProfileForm", "Enter a valid email address.");
    return;
  }

  if (!HEAD_PHONE_REGEX.test(phone)) {
    setDeptHeadFormMessage("editProfileForm", "Enter a valid phone number.");
    return;
  }

  profileData.name = name;
  profileData.email = email;
  profileData.phone = phone;
  profileData.location = location;

  document.getElementById("profileName").textContent = profileData.name;
  document.getElementById("infoName").textContent = profileData.name;
  document.getElementById("infoEmail").textContent = profileData.email;
  document.getElementById("infoPhone").textContent = profileData.phone;
  document.getElementById("infoLocation").textContent = profileData.location;

  document.querySelector(".avatar-name").textContent = profileData.name;
  document.querySelector(".avatar-email").textContent = profileData.email;

  setDeptHeadFormMessage("editProfileForm", "Profile updated successfully.", "success");
  closeModal("editProfileModal");
}

// Reposition dropdowns on window resize
window.addEventListener("resize", function () {
  if (dropdownMenu.classList.contains("show")) {
    positionDropdown(avatarButton, dropdownMenu);
  }
  if (notificationPanel.classList.contains("show")) {
    positionDropdown(bellButton, notificationPanel, false);
  }
});

initNotifications();

// Bind default CRUD assumptions for existing action buttons in this UI.
document.querySelectorAll(".mini-action").forEach((btn) => {
  btn.dataset.rbacAction = "update";
  btn.dataset.rbacModule = "complaints";
});

document.querySelectorAll(".view-all-btn").forEach((btn) => {
  btn.dataset.rbacAction = "read";
  btn.dataset.rbacModule = "dashboard";
});

document.querySelectorAll(".sign-out-button").forEach((btn) => {
  btn.addEventListener("click", signOut);
});

renderDeptHeadHierarchyTables();

guardRestrictedActions();
document.getElementById("editProfileForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  saveProfile();
});
navigateTo(getSavedDeptHeadPage());
