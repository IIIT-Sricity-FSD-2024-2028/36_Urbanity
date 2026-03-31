const notificationTemplates = [
  {
    type: "success",
    title: "Issue Submitted",
    message: "Your complaint has been recorded and sent to the department.",
    time: "just now",
  },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9()\-\s]{8,20}$/;

const notificationReadState = {};
const notificationHiddenState = {};
let notifications = [];

function showCitizenToast(message, type = "info") {
  if (window.UIFeedback?.toast) {
    window.UIFeedback.toast({ scope: "citizen", message, type });
    return;
  }
  console[type === "error" ? "error" : "log"](message);
}

function showCitizenDialog({ title, message, confirmText, cancelText, inputValue }) {
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

let issues = [
  {
    id: "ISS-456",
    title: "Street Light Not Working",
    description:
      "The street light has been out for 3 days causing visibility issues.",
    location: "Oak Street",
    status: "pending",
    upvotes: 23,
    date: "March 10, 2026",
    category: "Infrastructure",
    upvoted: false,
  },
  {
    id: "ISS-457",
    title: "Garbage Not Collected",
    description: "Trash bins overflowing for the past week.",
    location: "Pine Avenue",
    status: "in-progress",
    upvotes: 15,
    date: "March 12, 2026",
    category: "Sanitation",
    upvoted: false,
  },
  {
    id: "ISS-458",
    title: "Water Leakage",
    description: "Major water leak on the main road causing traffic disruption.",
    location: "Maple Drive",
    status: "pending",
    upvotes: 34,
    date: "March 15, 2026",
    category: "Infrastructure",
    upvoted: false,
  },
  {
    id: "ISS-459",
    title: "Pothole Repair Needed",
    description: "Large pothole causing damage to vehicles.",
    location: "Cedar Lane",
    status: "resolved",
    upvotes: 18,
    date: "March 8, 2026",
    category: "Roads",
    upvoted: false,
  },
];

function mapCategoryToDepartment(categoryValue) {
  const normalized = (categoryValue || "").toLowerCase();
  if (normalized === "roads" || normalized === "infrastructure") {
    return "Road";
  }
  if (normalized === "sanitation") {
    return "Sanitation";
  }
  if (normalized === "water") {
    return "Water Services";
  }
  if (normalized === "electricity") {
    return "Water Services";
  }
  return "Road";
}

function formatCitizenCategory(categoryValue) {
  const normalized = (categoryValue || "").toLowerCase();
  if (normalized === "roads") return "Roads";
  if (normalized === "water") return "Water";
  if (normalized === "electricity") return "Electricity";
  if (normalized === "sanitation") return "Sanitation";
  if (normalized === "infrastructure") return "Infrastructure";
  return "Other";
}

function normalizeMediaList(mediaList) {
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

function renderMediaPreviewHtml(mediaList) {
  const media = normalizeMediaList(mediaList);
  if (media.length === 0) {
    return "";
  }

  return `
    <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">
      ${media
        .map((item) => {
          const isVideo = item.type === "video";
          return `
            <a href="${item.url}" target="_blank" rel="noopener" style="display:block; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; background:#fff; text-decoration:none;">
              ${
                isVideo
                  ? `<video src="${item.url}" style="width:100%; height:88px; object-fit:cover; display:block;" muted></video>`
                  : `<img src="${item.url}" alt="${item.name}" style="width:100%; height:88px; object-fit:cover; display:block;" />`
              }
              <span style="display:block; padding:6px 8px; font-size:12px; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</span>
            </a>
          `;
        })
        .join("")}
    </div>
  `;
}

function readFilesAsMedia(fileList) {
  const files = Array.from(fileList || []).slice(0, 4);
  if (files.length === 0) {
    return Promise.resolve([]);
  }

  const readers = files.map(
    (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const type = file.type.startsWith("video/") ? "video" : "image";
          resolve({
            type,
            url: String(reader.result || ""),
            name: file.name,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      }),
  );

  return Promise.all(readers).then((items) => items.filter(Boolean));
}

function generateCitizenIssueId() {
  if (!window.MockDataAPI) {
    return `CMP-${Date.now().toString().slice(-6)}`;
  }

  const complaints = window.MockDataAPI.list("complaints");
  const used = complaints
    .map((item) => {
      const match = /^CMP-(\d+)$/.exec(item.id || "");
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => value > 0);

  const next = (used.length ? Math.max(...used) : 1000) + 1;
  return `CMP-${String(next).padStart(4, "0")}`;
}

function loadCitizenComplaintsFromStore() {
  if (!window.MockDataAPI) {
    return;
  }

  const complaints = getCitizenScopedComplaints();
  if (complaints.length === 0) {
    issues = [];
    return;
  }

  issues = complaints.map((complaint) => ({
    id: complaint.id,
    title: complaint.title,
    description: complaint.description,
    location: complaint.location,
    status: complaint.status || "pending",
    upvotes: Number(complaint.upvotes || 0),
    date: complaint.date || new Date().toLocaleDateString(),
    category: complaint.category || "Other",
    upvoted: false,
    feedback: complaint.feedback || null,
    feedbackSubmittedAt: complaint.feedbackSubmittedAt || null,
    media: normalizeMediaList(complaint.media),
    resolutionMedia: normalizeMediaList(complaint.resolutionMedia),
  }));
}

function getCitizenScopedComplaints() {
  if (!window.MockDataAPI) {
    return [];
  }

  const complaints = window.MockDataAPI.list("complaints");
  const currentUser = getCurrentSessionUser();

  if (!currentUser) {
    return complaints;
  }

  return complaints.filter((complaint) => {
    if (complaint.reportedById && currentUser.id) {
      return complaint.reportedById === currentUser.id;
    }

    if (complaint.reportedByEmail && currentUser.email) {
      return complaint.reportedByEmail === currentUser.email;
    }

    return complaint.reportedBy === currentUser.name;
  });
}

function buildCitizenNotifications() {
  const dynamicNotifications = issues
    .map((issue) => {
      const issueNumber = issue.id;
      if (issue.status === "resolved") {
        if (issue.feedbackSubmittedAt) {
          return {
            id: `resolved-${issue.id}`,
            type: "success",
            title: "Issue Closed",
            message: `Complaint ${issueNumber} is resolved. Thanks for sharing feedback.`,
            time: issue.feedbackSubmittedAt,
            read: false,
          };
        }

        return {
          id: `feedback-${issue.id}`,
          type: "warning",
          title: "Issue Resolved",
          message: `Complaint ${issueNumber} is resolved. Please submit feedback.`,
          time: issue.date,
          read: false,
        };
      }

      if (issue.status === "in-progress") {
        return {
          id: `progress-${issue.id}`,
          type: "info",
          title: "Work In Progress",
          message: `Department team is actively working on complaint ${issueNumber}.`,
          time: issue.date,
          read: false,
        };
      }

      return {
        id: `pending-${issue.id}`,
        type: "info",
        title: "Issue Received",
        message: `Complaint ${issueNumber} is waiting for officer assignment.`,
        time: issue.date,
        read: false,
      };
    })
    .filter((item) => !notificationHiddenState[item.id]);

  return [...dynamicNotifications, ...notificationTemplates.map((item, index) => ({ ...item, id: `template-${index + 1}` }))]
    .map((item) => ({
      ...item,
      read: Boolean(notificationReadState[item.id]),
    }))
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

function syncCitizenIssueUpdate(issueId, partial) {
  if (!window.MockDataAPI) {
    return;
  }

  window.MockDataAPI.update("complaints", issueId, partial);
}

function syncCitizenIssueDelete(issueId) {
  if (!window.MockDataAPI) {
    return;
  }

  window.MockDataAPI.remove("complaints", issueId);
}

function syncCitizenIssueAdd(issue) {
  if (!window.MockDataAPI) {
    return;
  }

  const currentUser = getCurrentSessionUser();

  window.MockDataAPI.add("complaints", {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    location: issue.location,
    status: issue.status,
    category: issue.category,
    department: issue.department,
    date: issue.date,
    upvotes: issue.upvotes,
    media: normalizeMediaList(issue.media),
    resolutionMedia: normalizeMediaList(issue.resolutionMedia),
    reportedBy: currentUser?.name || profileData.name || "Citizen",
    reportedById: currentUser?.id,
    reportedByEmail: currentUser?.email || profileData.email,
  });
}

const profileData = {
  name: "John Doe",
  email: "johndoe@email.com",
  phone: "+1 (555) 123-4567",
  address: "123 Main Street, Springfield, ST 12345",
};

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

function getCitizenInitials() {
  return profileData.name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function applySessionUserToCitizen() {
  const currentUser = getCurrentSessionUser();
  if (!currentUser) {
    return;
  }

  profileData.name = currentUser.name || profileData.name;
  profileData.email = currentUser.email || profileData.email;

  const headerName = document.querySelector(".profile-btn-name");
  const headerEmail = document.querySelector(".profile-btn-email");
  const headerAvatar = document.querySelector(".profile-avatar");
  const initials = getCitizenInitials();

  if (headerName) headerName.textContent = profileData.name;
  if (headerEmail) headerEmail.textContent = profileData.email;
  if (headerAvatar) headerAvatar.textContent = initials;
}

const CITIZEN_PAGE_STATE_KEY = "urbanity.citizen.lastPage";
const CITIZEN_ALLOWED_PAGES = [
  "dashboard",
  "raise-issue",
  "my-complaints",
  "feedback",
  "profile",
];

const CITIZEN_DEFAULT_PERMISSIONS = {
  complaints: ["create", "read", "update"],
  profile: ["read", "update"],
};

const CITIZEN_PAGE_ACCESS = {
  dashboard: { module: "complaints", action: "read" },
  "raise-issue": { module: "complaints", action: "create" },
  "my-complaints": { module: "complaints", action: "read" },
  feedback: { module: "complaints", action: "update" },
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
const citizenPermissions = roleContext.permissions || CITIZEN_DEFAULT_PERMISSIONS;

if (
  roleContext.role !== "citizen" &&
  roleContext.role !== "super_user_admin" &&
  roleContext.role !== "domain_admin_dept_head"
) {
  showCitizenToast("Access denied: This portal is only for Citizen role. Redirecting to sign in.", "error");
  window.setTimeout(() => {
    window.location.href = "../Authentication/auth.html";
  }, 900);
}

applySessionUserToCitizen();

function persistCitizenPage(page) {
  sessionStorage.setItem(CITIZEN_PAGE_STATE_KEY, page);
}

function hasPermission(moduleName, action) {
  const wildcard = citizenPermissions["*"] || [];
  const moduleAccess = citizenPermissions[moduleName] || [];
  return wildcard.includes(action) || moduleAccess.includes(action);
}

function hasPageAccess(page) {
  if (!CITIZEN_ALLOWED_PAGES.includes(page)) {
    return false;
  }

  const config = CITIZEN_PAGE_ACCESS[page];
  if (!config) {
    return false;
  }

  return hasPermission(config.module, config.action);
}

function getFirstAccessibleCitizenPage() {
  const first = CITIZEN_ALLOWED_PAGES.find((page) => hasPageAccess(page));
  return first || "dashboard";
}

function applyCitizenRoleRendering() {
  document.querySelectorAll("#sidebarNav .nav-item").forEach((item) => {
    const page = item.dataset.page;
    item.style.display = hasPageAccess(page) ? "" : "none";
  });
}

function getSavedCitizenPage() {
  const saved = sessionStorage.getItem(CITIZEN_PAGE_STATE_KEY);
  if (!saved) {
    return getFirstAccessibleCitizenPage();
  }

  return hasPageAccess(saved) ? saved : getFirstAccessibleCitizenPage();
}

function signOut() {
  sessionStorage.removeItem("urbanityRoleContext");
  sessionStorage.removeItem("urbanityRole");
  sessionStorage.removeItem("urbanityRoleLabel");
  sessionStorage.removeItem("urbanityCurrentUser");
  sessionStorage.removeItem(CITIZEN_PAGE_STATE_KEY);
  window.location.href = "../Landing Page/landingpage.html";
}

const dashboardNearbyIds = ["ISS-456", "ISS-459"];
let currentPage = "dashboard";
let selectedRating = 0;

function getPageContent(page) {
  switch (page) {
    case "dashboard":
      return renderDashboardPage();
    case "raise-issue":
      return renderRaiseIssuePage();
    case "my-complaints":
      return renderComplaintsPage();
    case "feedback":
      return renderFeedbackPage();
    case "profile":
      return renderProfilePage();
    default:
      return renderDashboardPage();
  }
}

function renderPage(page) {
  currentPage = page;

  const pageContent = document.getElementById("pageContent");
  if (!pageContent) return;

  pageContent.innerHTML = getPageContent(page);
  setActiveNav(page);
  bindPageEvents(page);
}

function setActiveNav(page) {
  document.querySelectorAll("#sidebarNav .nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === page);
  });
}

function navigateTo(page) {
  if (!hasPageAccess(page)) {
    return;
  }

  renderPage(page);
  persistCitizenPage(page);
  document.getElementById("profileDropdown")?.classList.remove("active");
  document.getElementById("notificationDropdown")?.classList.remove("active");
}

function bindShellEvents() {
  document.querySelectorAll("#sidebarNav .nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  document.querySelectorAll(".profile-menu-item[data-page]").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  const notificationBtn = document.getElementById("notificationBtn");
  const notificationDropdown = document.getElementById("notificationDropdown");
  const profileBtn = document.getElementById("profileBtn");
  const profileDropdown = document.getElementById("profileDropdown");

  notificationBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    notificationDropdown?.classList.toggle("active");
    profileDropdown?.classList.remove("active");
  });

  profileBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown?.classList.toggle("active");
    notificationDropdown?.classList.remove("active");
  });

  document.addEventListener("click", (e) => {
    if (
      notificationDropdown &&
      notificationBtn &&
      !notificationDropdown.contains(e.target) &&
      !notificationBtn.contains(e.target)
    ) {
      notificationDropdown.classList.remove("active");
    }

    if (
      profileDropdown &&
      profileBtn &&
      !profileDropdown.contains(e.target) &&
      !profileBtn.contains(e.target)
    ) {
      profileDropdown.classList.remove("active");
    }
  });

  document
    .getElementById("editProfileModal")
    ?.addEventListener("click", (e) => {
      if (e.target.id === "editProfileModal") {
        closeEditModal();
      }
    });

  document.querySelector(".sign-out-btn")?.addEventListener("click", signOut);
  document
    .querySelector(".profile-signout-btn")
    ?.addEventListener("click", signOut);

  renderNotifications();
}

function renderNotifications() {
  const notificationList = document.getElementById("notificationList");
  const notificationBadge = document.getElementById("notificationBadge");
  const markAllRead = document.getElementById("markAllRead");
  if (!notificationList || !notificationBadge) return;

  notifications = buildCitizenNotifications();

  const unreadCount = notifications.filter((n) => !n.read).length;
  notificationBadge.textContent = unreadCount;
  notificationBadge.style.display = unreadCount > 0 ? "flex" : "none";

  if (markAllRead) {
    markAllRead.style.display = unreadCount > 0 ? "block" : "none";
    markAllRead.onclick = () => {
      notifications.forEach((n) => {
        notificationReadState[n.id] = true;
      });
      renderNotifications();
    };
  }

  notificationList.innerHTML = notifications
    .map(
      (notification) => `
        <div class="notification-item ${!notification.read ? "unread" : ""}">
          <div class="notification-content">
            <div class="notification-icon">${getNotificationIcon(notification.type)}</div>
            <div class="notification-body">
              <div class="notification-top">
                <div class="notification-title">${notification.title}</div>
                <button class="notification-delete" onclick="deleteNotification('${notification.id}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div class="notification-message">${notification.message}</div>
              <div class="notification-footer-actions">
                <span class="notification-time">${notification.time}</span>
                ${
                  !notification.read
                    ? `<button class="mark-read-btn" onclick="markAsRead('${notification.id}')">Mark as read</button>`
                    : ""
                }
              </div>
            </div>
          </div>
        </div>
      `,
    )
    .join("");
}

function getNotificationIcon(type) {
  const icons = {
    success:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    warning:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    info:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  };

  return icons[type] || icons.info;
}

function markAsRead(id) {
  notificationReadState[id] = true;
  renderNotifications();
}

function deleteNotification(id) {
  notificationHiddenState[id] = true;
  renderNotifications();
}

function renderDashboardPage() {
  const nearbyIssues = issues.slice(0, 3);
  const totalIssues = issues.length;
  const resolvedIssues = issues.filter((issue) => issue.status === "resolved").length;
  const pendingIssues = issues.filter((issue) => issue.status === "pending").length;

  return `
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">City Overview</h1>
        <p class="page-subtitle">Real-time status of civic issues in your area.</p>
      </div>
      <button class="raise-issue-btn" id="raiseIssueBtn">
        <span class="plus-icon">+</span>
        RAISE NEW ISSUE
      </button>
    </div>

    <div class="stats-grid-dashboard">
      <div class="stat-card-dashboard">
        <div class="stat-icon-wrapper blue">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <div class="stat-info">
          <p class="stat-number">${totalIssues}</p>
          <p class="stat-text">Total Issues</p>
        </div>
      </div>
      <div class="stat-card-dashboard">
        <div class="stat-icon-wrapper green">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="stat-info">
          <p class="stat-number">${resolvedIssues}</p>
          <p class="stat-text">Resolved</p>
        </div>
      </div>
      <div class="stat-card-dashboard">
        <div class="stat-icon-wrapper orange">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div class="stat-info">
          <p class="stat-number">${pendingIssues}</p>
          <p class="stat-text">Pending</p>
        </div>
      </div>
      <div class="stat-card-dashboard">
        <div class="stat-icon-wrapper purple">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div class="stat-info">
          <p class="stat-number">${totalIssues}</p>
          <p class="stat-text">My Reports</p>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="map-section">
        <div class="map-card">
          <h3 class="section-title">Live Issue Map</h3>
          <div class="map-placeholder"><p>Map view coming soon</p></div>
        </div>
      </div>

      <div class="issues-section">
        <div class="issues-card">
          <h3 class="section-title">Issues Near You</h3>
          <div class="issues-list">
            ${nearbyIssues
              .map(
                (issue) => `
                  <div class="issue-item" onclick="openIssueModal('${issue.id}')">
                    <div class="issue-header-row">
                      <h4 class="issue-title-text">${issue.title}</h4>
                      <span class="issue-status ${issue.status}">${formatStatus(issue.status).toUpperCase()}</span>
                    </div>
                    <p class="issue-category">Location: ${issue.category}</p>
                    <p class="issue-date">${issue.date}</p>
                  </div>
                `,
              )
              .join("")}
          </div>
          <button class="view-all-link" id="viewAllActivityBtn">View All Activity</button>
        </div>
      </div>
    </div>
  `;
}

function renderRaiseIssuePage() {
  return `
    <div class="page-header">
      <h1 class="page-title">Raise an Issue</h1>
      <p class="page-subtitle">Report any civic issues in your area and help us serve you better.</p>
    </div>

    <div class="form-container">
      <h3 class="form-title">Issue Details</h3>
      <form id="raiseIssueForm">
        <div class="form-group">
          <label class="form-label">Issue Category *</label>
          <select class="form-select" required>
            <option value="">Select a category</option>
            <option value="roads">Roads & Transportation</option>
            <option value="water">Water Supply</option>
            <option value="electricity">Electricity</option>
            <option value="sanitation">Sanitation</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Issue Title *</label>
          <input type="text" class="form-input" placeholder="Brief title of your issue" required>
        </div>

        <div class="form-group">
          <label class="form-label">Location *</label>
          <input type="text" class="form-input" placeholder="Street name or landmark" required>
        </div>

        <div class="form-group">
          <label class="form-label">Detailed Description *</label>
          <textarea class="form-textarea" rows="6" placeholder="Please provide a detailed description of the issue..." required></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Contact Number (Optional)</label>
          <input type="tel" class="form-input" placeholder="+1 (555) 000-0000">
          <p class="form-hint">We'll use this to update you on the issue status</p>
        </div>

        <div class="form-group">
          <label class="form-label">Upload Image / Video (Optional)</label>
          <input type="file" class="form-input" id="issueMediaInput" accept="image/*,video/*" multiple>
          <p class="form-hint">You can attach up to 4 files as evidence.</p>
        </div>

        <button type="submit" class="form-button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          Submit Issue
        </button>
      </form>
    </div>
  `;
}

function renderComplaintsPage() {
  return `
    <div class="page-header">
      <h1 class="page-title">My Complaints</h1>
      <p class="page-subtitle">Track and manage all your submitted issues.</p>
    </div>

    <div class="complaints-container">
      <div class="complaints-search-bar">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input type="text" class="search-input" placeholder="Search complaints...">
        </div>
        <button class="filter-button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          Filter
        </button>
      </div>

      <div class="complaints-table-wrapper">
        <table class="complaints-table">
          <thead>
            <tr>
              <th>Issue ID</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Date</th>
              <th>Priority</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${issues
              .map(
                (issue, idx) => `
                  <tr>
                    <td><span class="complaint-id">${issue.id}</span></td>
                    <td><span class="complaint-title">${issue.title}</span></td>
                    <td><span class="complaint-category">${issue.category}</span></td>
                    <td><span class="status-badge ${issue.status}">${formatStatus(issue.status).toUpperCase()}</span></td>
                    <td><span class="complaint-date">${issue.date}</span></td>
                    <td><span class="complaint-priority">${idx === 0 ? "High" : "Medium"}</span></td>
                    <td>
                      <div class="action-buttons">
                        <button class="action-btn" title="View Details" onclick="openIssueModal('${issue.id}')">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>
                        <button class="action-btn" title="Edit Issue" onclick="editCitizenIssue('${issue.id}')">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button class="action-btn" title="Delete Issue" onclick="deleteCitizenIssue('${issue.id}')">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6"></path>
                            <path d="M14 11v6"></path>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                          </svg>
                        </button>
                        <button class="action-btn message-btn" title="Messages">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                          </svg>
                          <span class="message-count">${idx + 2}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="complaints-pagination">
        <p class="pagination-info">Showing <span class="font-medium">1-${issues.length}</span> of <span class="font-medium">${issues.length}</span> results</p>
        <div class="pagination-buttons">
          <button class="pagination-btn">Previous</button>
          <button class="pagination-btn">Next</button>
        </div>
      </div>
    </div>
  `;
}

function renderFeedbackPage() {
  const resolvedIssues = issues.filter((issue) => issue.status === "resolved");

  return `
    <div class="page-header">
      <h1 class="page-title">Feedback</h1>
      <p class="page-subtitle">Share your experience on resolved issues to help us improve our services.</p>
    </div>

    <div class="sidebar-info-grid">
      <div class="form-container" style="max-width: none; margin: 0;">
        <h3 class="form-title">Share Your Feedback</h3>
        <form id="feedbackForm">
          <div class="form-group">
            <label class="form-label">Select Resolved Issue *</label>
            <select class="form-select" id="issueSelect" required>
              <option value="">Select a resolved issue</option>
              ${resolvedIssues
                .map(
                  (issue) => `<option value="${issue.id}">${issue.id} - ${issue.title} (Resolved: ${issue.date})</option>`,
                )
                .join("")}
            </select>
            <p class="form-hint">Select an issue that has been resolved to provide feedback</p>
          </div>

          <div class="form-group">
            <label class="form-label">Feedback Category *</label>
            <select class="form-select" required>
              <option value="">Select a category</option>
              <option value="resolution_quality">Resolution Quality</option>
              <option value="response_time">Response Time</option>
              <option value="communication">Communication</option>
              <option value="overall_satisfaction">Overall Satisfaction</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Rate Your Experience *</label>
            <div class="star-rating" id="starRating">
              ${[1, 2, 3, 4, 5]
                .map(
                  (rating) => `
                    <button type="button" class="star-btn" data-rating="${rating}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                    </button>
                  `,
                )
                .join("")}
            </div>
            <p class="rating-label" id="ratingLabel">Click to rate your experience</p>
          </div>

          <div class="form-group">
            <label class="form-label">Your Feedback *</label>
            <textarea class="form-textarea" rows="6" placeholder="Tell us about your experience with the resolution of this issue..." required></textarea>
          </div>

          <button type="submit" class="form-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Submit Feedback
          </button>
        </form>
      </div>

      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div class="info-card blue">
          <h3 class="info-card-title">Why Your Feedback Matters</h3>
          <ul class="info-list">
            <li><span class="info-list-bullet">-</span><span>Helps us improve our resolution quality and processes</span></li>
            <li><span class="info-list-bullet">-</span><span>Identifies areas needing immediate attention</span></li>
            <li><span class="info-list-bullet">-</span><span>Shapes future development of citizen services</span></li>
            <li><span class="info-list-bullet">-</span><span>Ensures your voice is heard in civic improvements</span></li>
          </ul>
        </div>

        <div class="info-card green" style="background-color: white;">
          <h3 class="info-card-title">Your Resolved Issues</h3>
          <div>
            ${[
              ...resolvedIssues.map((issue) => [issue.title, issue.id, issue.date]),
            ]
              .map(
                ([title, id, date]) => `
                  <div class="resolved-issue-card">
                    <div class="resolved-issue-header">
                      <div>
                        <div class="resolved-issue-title">${title}</div>
                        <div class="resolved-issue-id">ID: ${id}</div>
                      </div>
                      <span class="resolved-badge">Resolved</span>
                    </div>
                    <div class="resolved-issue-date">Resolved on ${date}</div>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProfilePage() {
  return `
    <div class="page-header">
      <h1 class="page-title">My Profile</h1>
      <p class="page-subtitle">View and manage your account information</p>
    </div>

    <div class="profile-grid">
      <div class="profile-card profile-card-center">
        <div class="profile-avatar-xl">${getCitizenInitials()}</div>
        <div class="profile-card-name" id="displayName">${profileData.name}</div>
        <div class="profile-card-id">Citizen ID: #CT2024-1234</div>
        <button class="profile-edit-btn" onclick="openEditModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit Profile
        </button>
      </div>

      <div>
        <div class="profile-card">
          <h3 class="profile-section-title">Personal Information</h3>
          <div class="profile-info-list">
            <div class="profile-info-item">
              <div class="profile-info-icon" style="background-color: #eff6ff;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div class="profile-info-text">
                <div class="profile-info-label">Full Name</div>
                <div class="profile-info-value" id="infoName">${profileData.name}</div>
              </div>
            </div>
            <div class="profile-info-item">
              <div class="profile-info-icon" style="background-color: #f0fdf4;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <div class="profile-info-text">
                <div class="profile-info-label">Email Address</div>
                <div class="profile-info-value" id="infoEmail">${profileData.email}</div>
              </div>
            </div>
            <div class="profile-info-item">
              <div class="profile-info-icon" style="background-color: #f3e8ff;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <div class="profile-info-text">
                <div class="profile-info-label">Phone Number</div>
                <div class="profile-info-value" id="infoPhone">${profileData.phone}</div>
              </div>
            </div>
            <div class="profile-info-item">
              <div class="profile-info-icon" style="background-color: #fef3c7;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div class="profile-info-text">
                <div class="profile-info-label">Address</div>
                <div class="profile-info-value" id="infoAddress">${profileData.address}</div>
              </div>
            </div>
            <div class="profile-info-item">
              <div class="profile-info-icon" style="background-color: #e0e7ff;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <div class="profile-info-text">
                <div class="profile-info-label">Member Since</div>
                <div class="profile-info-value">January 15, 2024</div>
              </div>
            </div>
          </div>
        </div>

        <div class="profile-card profile-stats-card">
          <h3 class="profile-section-title">Account Statistics</h3>
          <div class="profile-stats-grid">
            <div class="profile-stat-card profile-stat-blue">
              <div class="profile-stat-value stat-value-blue">12</div>
              <div class="profile-stat-label">Total Issues Reported</div>
            </div>
            <div class="profile-stat-card profile-stat-green">
              <div class="profile-stat-value stat-value-green">8</div>
              <div class="profile-stat-label">Issues Resolved</div>
            </div>
            <div class="profile-stat-card profile-stat-purple">
              <div class="profile-stat-value stat-value-purple">45</div>
              <div class="profile-stat-label">Community Upvotes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindPageEvents(page) {
  if (page === "dashboard") {
    document
      .getElementById("raiseIssueBtn")
      ?.addEventListener("click", () => navigateTo("raise-issue"));
    document
      .getElementById("viewAllActivityBtn")
      ?.addEventListener("click", () => navigateTo("my-complaints"));
  }

  if (page === "raise-issue") {
    document.getElementById("raiseIssueForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const category = form.querySelector("select")?.value;
      const title = form.querySelector('input[type="text"]')?.value.trim();
      const location = form.querySelectorAll('input[type="text"]')[1]?.value.trim();
      const description = form.querySelector("textarea")?.value.trim();
      const mediaInput = document.getElementById("issueMediaInput");

      setCitizenFormMessage("raiseIssueForm", "");

      if (!category || !title || !location || !description) {
        setCitizenFormMessage("raiseIssueForm", "Please complete all required issue fields.");
        return;
      }

      if (title.length < 5) {
        setCitizenFormMessage("raiseIssueForm", "Issue title should be at least 5 characters.");
        return;
      }

      if (description.length < 15) {
        setCitizenFormMessage("raiseIssueForm", "Description should be at least 15 characters.");
        return;
      }

      const media = await readFilesAsMedia(mediaInput?.files);

      const issue = {
        id: generateCitizenIssueId(),
        title,
        description,
        location,
        status: "pending",
        upvotes: 0,
        date: new Date().toLocaleDateString(),
        category: formatCitizenCategory(category),
        department: mapCategoryToDepartment(category),
        upvoted: false,
        media,
        resolutionMedia: [],
      };

      issues.unshift(issue);
      syncCitizenIssueAdd(issue);

      setCitizenFormMessage(
        "raiseIssueForm",
        "Issue submitted successfully! You will be notified about the progress.",
        "success",
      );
      e.target.reset();
      navigateTo("my-complaints");
    });
  }

  if (page === "feedback") {
    bindFeedbackPage();
  }
}

function bindFeedbackPage() {
  selectedRating = 0;

  const starButtons = document.querySelectorAll(".star-btn");
  const ratingLabel = document.getElementById("ratingLabel");
  const labels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

  starButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const rating = Number(btn.dataset.rating);
      selectedRating = rating;
      updateStars(rating);
      ratingLabel.textContent = labels[rating];
    });

    btn.addEventListener("mouseenter", () => {
      updateStars(Number(btn.dataset.rating));
    });

    btn.addEventListener("mouseleave", () => {
      updateStars(selectedRating);
    });
  });

  document.getElementById("feedbackForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const issueId = document.getElementById("issueSelect")?.value;
    const category = form.querySelectorAll(".form-select")[1]?.value;
    const comments = form.querySelector("textarea")?.value.trim();

    setCitizenFormMessage("feedbackForm", "");

    if (!issueId) {
      setCitizenFormMessage("feedbackForm", "Please select a resolved issue.");
      return;
    }

    if (!category || !comments) {
      setCitizenFormMessage("feedbackForm", "Please complete feedback category and comments.");
      return;
    }

    if (comments.length < 10) {
      setCitizenFormMessage("feedbackForm", "Feedback comments should be at least 10 characters.");
      return;
    }

    if (selectedRating === 0) {
      setCitizenFormMessage("feedbackForm", "Please provide a rating.");
      return;
    }

    const issue = issues.find((item) => item.id === issueId);
    if (issue) {
      issue.feedback = {
        rating: selectedRating,
        category,
        comments,
      };
      issue.feedbackSubmittedAt = new Date().toLocaleString();
      syncCitizenIssueUpdate(issue.id, {
        feedback: issue.feedback,
        feedbackSubmittedAt: issue.feedbackSubmittedAt,
      });
    }

    setCitizenFormMessage("feedbackForm", "Thank you for your feedback!", "success");
    form.reset();
    selectedRating = 0;
    updateStars(0);
    ratingLabel.textContent = "Click to rate your experience";
    renderNotifications();
  });
}

function setCitizenFormMessage(formId, text, type = "error") {
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

function updateStars(rating) {
  document.querySelectorAll(".star-btn").forEach((btn, index) => {
    btn.classList.toggle("filled", index < rating);
  });
}

function formatStatus(status) {
  const statusMap = {
    pending: "Pending",
    "in-progress": "In Progress",
    resolved: "Resolved",
  };

  return statusMap[status] || status;
}

function openIssueModal(issueId) {
  loadCitizenComplaintsFromStore();
  const issue = issues.find((i) => i.id === issueId);
  if (!issue) return;

  const modal = document.getElementById("issueModal");
  const title = document.getElementById("modalIssueTitle");
  const statusBadge = document.getElementById("modalStatusBadge");
  const categoryText = document.getElementById("modalCategoryText");
  const body = document.getElementById("modalBodyContent");

  if (!modal || !title || !statusBadge || !categoryText || !body) return;

  title.textContent = issue.title;
  statusBadge.textContent = formatStatus(issue.status).toUpperCase();
  statusBadge.className = `modal-status-badge ${issue.status}`;
  categoryText.textContent = `#${issue.category}`;

  body.innerHTML = `
    <div class="modal-detail-section">
      <div class="modal-detail-row">
        <svg class="modal-detail-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        <div>
          <div class="modal-detail-label">Location</div>
          <div class="modal-detail-value">${issue.location}</div>
        </div>
      </div>

      <div class="modal-detail-row">
        <svg class="modal-detail-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <div>
          <div class="modal-detail-label">Date Reported</div>
          <div class="modal-detail-value">${issue.date}</div>
        </div>
      </div>

      <div class="modal-description-section">
        <div class="modal-detail-label">Description</div>
        <div class="modal-description-text">${issue.description}</div>
      </div>

      ${
        issue.media && issue.media.length
          ? `
      <div class="modal-description-section">
        <div class="modal-detail-label">Complaint Media</div>
        ${renderMediaPreviewHtml(issue.media)}
      </div>`
          : ""
      }

      ${
        issue.status === "resolved" && issue.resolutionMedia && issue.resolutionMedia.length
          ? `
      <div class="modal-description-section">
        <div class="modal-detail-label">Resolution Proof</div>
        ${renderMediaPreviewHtml(issue.resolutionMedia)}
      </div>`
          : ""
      }

      <div class="modal-upvote-section">
        <div class="modal-upvote-header">
          <div class="modal-upvote-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
            Community Support
          </div>
          <div class="modal-upvote-count">${issue.upvotes} upvotes</div>
        </div>

        <button class="modal-upvote-button ${issue.upvoted ? "upvoted" : ""}" onclick="toggleUpvote('${issue.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
          </svg>
          ${issue.upvoted ? "Upvoted" : "Upvote this issue"}
        </button>
      </div>
    </div>
  `;

  modal.classList.add("active");
}

function closeIssueModal() {
  document.getElementById("issueModal")?.classList.remove("active");
}

function toggleUpvote(issueId) {
  const issue = issues.find((i) => i.id === issueId);
  if (!issue) return;

  issue.upvoted = !issue.upvoted;
  issue.upvotes += issue.upvoted ? 1 : -1;
  syncCitizenIssueUpdate(issueId, { upvotes: issue.upvotes });
  openIssueModal(issueId);
}

async function editCitizenIssue(issueId) {
  const issue = issues.find((item) => item.id === issueId);
  if (!issue) {
    return;
  }

  const result = await showCitizenDialog({
    title: "Edit Issue Title",
    message: "Update the complaint title below.",
    confirmText: "Save",
    cancelText: "Cancel",
    inputValue: issue.title,
  });

  const nextTitle = (result.value || "").trim();
  if (!result.confirmed || !nextTitle) {
    return;
  }

  issue.title = nextTitle;
  syncCitizenIssueUpdate(issueId, { title: issue.title });
  showCitizenToast("Complaint title updated.", "success");

  if (currentPage === "my-complaints") {
    renderPage("my-complaints");
  }
}

async function deleteCitizenIssue(issueId) {
  const result = await showCitizenDialog({
    title: "Delete Complaint",
    message: "Delete this complaint? This action cannot be undone.",
    confirmText: "Delete",
    cancelText: "Cancel",
  });

  if (!result.confirmed) {
    return;
  }

  issues = issues.filter((item) => item.id !== issueId);
  syncCitizenIssueDelete(issueId);
  showCitizenToast("Complaint deleted.", "success");

  if (currentPage === "my-complaints") {
    renderPage("my-complaints");
  }
}

function openEditModal() {
  document.getElementById("editName").value = profileData.name;
  document.getElementById("editEmail").value = profileData.email;
  document.getElementById("editPhone").value = profileData.phone;
  document.getElementById("editAddress").value = profileData.address;
  setCitizenFormMessage("editProfileForm", "");
  document.getElementById("editProfileModal")?.classList.add("active");
}

function closeEditModal() {
  document.getElementById("editProfileModal")?.classList.remove("active");
}

function saveProfile() {
  if (!hasPermission("profile", "update")) {
    setCitizenFormMessage("editProfileForm", "You do not have permission to update profile details.");
    return;
  }

  const name = (document.getElementById("editName").value || "").trim();
  const email = (document.getElementById("editEmail").value || "").trim().toLowerCase();
  const phone = (document.getElementById("editPhone").value || "").trim();
  const address = (document.getElementById("editAddress").value || "").trim();

  if (!name || !email || !phone || !address) {
    setCitizenFormMessage("editProfileForm", "Please complete all profile fields.");
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    setCitizenFormMessage("editProfileForm", "Enter a valid email address.");
    return;
  }

  if (!PHONE_REGEX.test(phone)) {
    setCitizenFormMessage("editProfileForm", "Enter a valid phone number.");
    return;
  }

  profileData.name = name;
  profileData.email = email;
  profileData.phone = phone;
  profileData.address = address;

  if (currentPage === "profile") {
    renderPage("profile");
  }

  closeEditModal();
}

document.addEventListener("DOMContentLoaded", () => {
  loadCitizenComplaintsFromStore();
  bindShellEvents();
  applyCitizenRoleRendering();

  document
    .getElementById("issueModal")
    ?.addEventListener("click", (e) => {
      if (e.target.id === "issueModal") {
        closeIssueModal();
      }
    });

  navigateTo(getSavedCitizenPage());
});
