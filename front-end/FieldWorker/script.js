let assignmentsData = [
  {
    id: "1234",
    issueDescription: "Pothole on Main Street",
    category: "Roads",
    location: "Main St, Block A",
    assignedDate: "2/17/2026",
    priority: "High",
    status: "Pending",
    details:
      "Large pothole causing traffic issues. Approximately 2 feet in diameter.",
    citizenName: "John Doe",
    citizenContact: "+1-555-0101",
  },
  {
    id: "1235",
    issueDescription: "Streetlight Not Working",
    category: "Electricity",
    location: "Park Ave, Block B",
    assignedDate: "2/17/2026",
    priority: "Medium",
    status: "In Progress",
    details: "Streetlight near the park entrance is not functioning.",
    citizenName: "Jane Smith",
    citizenContact: "+1-555-0102",
  },
  {
    id: "1236",
    issueDescription: "Water Leakage",
    category: "Water",
    location: "2nd Street, Block C",
    assignedDate: "2/16/2026",
    priority: "High",
    status: "In Progress",
    details: "Water pipe leaking on the street corner.",
    citizenName: "Bob Johnson",
    citizenContact: "+1-555-0103",
  },
  {
    id: "1237",
    issueDescription: "Garbage Not Collected",
    category: "Sanitation",
    location: "Green Park, Block D",
    assignedDate: "2/16/2026",
    priority: "Medium",
    status: "Pending",
    details: "Garbage bins overflowing, collection missed for 3 days.",
    citizenName: "Alice Brown",
    citizenContact: "+1-555-0104",
  },
  {
    id: "1238",
    issueDescription: "Broken Pavement",
    category: "Roads",
    location: "Oak Street, Block E",
    assignedDate: "2/15/2026",
    priority: "Low",
    status: "In Progress",
    details: "Sidewalk pavement broken, potential safety hazard.",
    citizenName: "Charlie Davis",
    citizenContact: "+1-555-0105",
  },
];

const mockWorker = {
  id: "W001",
  name: "Worker Mike",
  email: "worker@urbanity.gov",
  rating: 4.8,
  totalCompleted: 18,
  phone: "+1-555-0100",
  employeeId: "EMP-2024-0042",
  department: "Roads",
  reportingOfficer: "Not Assigned",
  departmentHead: "Not Assigned",
};

function showWorkerToast(message, type = "info") {
  if (window.UIFeedback?.toast) {
    window.UIFeedback.toast({ scope: "worker", message, type });
    return;
  }
  console[type === "error" ? "error" : "log"](message);
}

function showWorkerDialog({ title, message, confirmText, cancelText, inputValue }) {
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
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-top: 8px;">
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
          resolve({ type, url: String(reader.result || ""), name: file.name });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      }),
  );

  return Promise.all(readers).then((items) => items.filter(Boolean));
}

function pickProofMediaFiles() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;

    input.addEventListener(
      "change",
      async () => {
        const media = await readFilesAsMedia(input.files);
        resolve(media.filter((item) => item.type === "image"));
      },
      { once: true },
    );

    input.click();
  });
}

function showAssignmentCompletionForm(task) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay show completion-form-overlay";
    overlay.innerHTML = `
      <div class="modal completion-form-modal" role="dialog" aria-modal="true" aria-label="Complete Assignment Form">
        <div class="modal-header">
          <h2 class="modal-title">Complete Assignment</h2>
          <button type="button" class="close-btn" aria-label="Close completion form">&times;</button>
        </div>
        <form class="modal-content completion-form" novalidate>
          <div class="completion-form-task">Task: ${task.issueDescription || "Assignment"}</div>

          <label class="completion-form-label" for="completionNoteInput">Completion Note</label>
          <input id="completionNoteInput" name="completionNote" class="completion-form-input" type="text" maxlength="160" value="${String(task.remarks || "Resolved on site and verified.").replace(/"/g, "&quot;")}" required />

          <label class="completion-form-label" for="workDetailsInput">Work Details</label>
          <textarea id="workDetailsInput" name="workDetails" class="completion-form-textarea" rows="4" placeholder="Explain what was fixed, checks performed, and final condition." required></textarea>

          <label class="completion-form-label" for="materialsInput">Materials / Tools Used (Optional)</label>
          <input id="materialsInput" name="materials" class="completion-form-input" type="text" maxlength="140" placeholder="Example: asphalt mix, shovel, cone barriers" />

          <label class="completion-form-label" for="proofFilesInput">Proof of Work (Required)</label>
          <input id="proofFilesInput" name="proofFiles" class="completion-form-file" type="file" accept="image/*" multiple required />
          <p class="completion-form-hint">Upload at least one image. You can attach up to 4 files.</p>

          <p class="completion-form-error" aria-live="polite"></p>

          <div class="completion-form-actions">
            <button type="button" class="modal-btn modal-btn-gray completion-form-cancel">Cancel</button>
            <button type="submit" class="modal-btn modal-btn-blue">Submit Completion</button>
          </div>
        </form>
      </div>
    `;

    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };

    const closeBtn = overlay.querySelector(".close-btn");
    const cancelBtn = overlay.querySelector(".completion-form-cancel");
    const form = overlay.querySelector("form");
    const errorNode = overlay.querySelector(".completion-form-error");
    const noteInput = overlay.querySelector("#completionNoteInput");
    const detailsInput = overlay.querySelector("#workDetailsInput");
    const materialsInput = overlay.querySelector("#materialsInput");
    const proofInput = overlay.querySelector("#proofFilesInput");

    closeBtn?.addEventListener("click", () => cleanup({ confirmed: false }));
    cancelBtn?.addEventListener("click", () => cleanup({ confirmed: false }));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cleanup({ confirmed: false });
      }
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const completionNote = String(noteInput?.value || "").trim();
      const workDetails = String(detailsInput?.value || "").trim();
      const materials = String(materialsInput?.value || "").trim();
      const selectedFiles = proofInput?.files;

      if (!completionNote) {
        if (errorNode) errorNode.textContent = "Please add a completion note.";
        noteInput?.focus();
        return;
      }

      if (workDetails.length < 12) {
        if (errorNode) errorNode.textContent = "Please enter at least 12 characters in work details.";
        detailsInput?.focus();
        return;
      }

      const proofMedia = (await readFilesAsMedia(selectedFiles)).filter((item) => item.type === "image");
      if (!proofMedia.length) {
        if (errorNode) errorNode.textContent = "Please upload at least one proof image.";
        proofInput?.focus();
        return;
      }

      cleanup({
        confirmed: true,
        completionNote,
        workDetails,
        materials,
        proofMedia,
      });
    });

    document.body.appendChild(overlay);
    detailsInput?.focus();
  });
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

function getStoreUsers() {
  if (!window.MockDataAPI) {
    return [];
  }
  return window.MockDataAPI.list("users");
}

function getWorkerHierarchyContext() {
  const sessionUser = getCurrentSessionUser();
  if (!sessionUser) {
    return {
      worker: null,
      officer: null,
      head: null,
    };
  }

  const users = getStoreUsers();
  const worker =
    users.find((user) => user.id === sessionUser.id) ||
    users.find((user) => user.email === sessionUser.email) ||
    sessionUser;
  const officer = users.find((user) => user.id === worker.officerId) || null;
  const head = users.find((user) => user.id === worker.headId) || null;

  return {
    worker,
    officer,
    head,
  };
}

function getWorkerInitials() {
  return mockWorker.name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function applySessionUserToWorker() {
  const { worker, officer, head } = getWorkerHierarchyContext();
  if (!worker) {
    return;
  }

  mockWorker.id = worker.id || mockWorker.id;
  mockWorker.name = worker.name || mockWorker.name;
  mockWorker.email = worker.email || mockWorker.email;
  mockWorker.department = worker.department || mockWorker.department;
  mockWorker.phone = worker.phone || mockWorker.phone;
  mockWorker.employeeId = worker.employeeCode || mockWorker.employeeId;
  mockWorker.reportingOfficer = officer?.name || "Not Assigned";
  mockWorker.departmentHead = head?.name || "Not Assigned";

  const nameNode = document.querySelector(".profile-btn-name");
  const emailNode = document.querySelector(".profile-btn-email");
  const avatarNode = document.querySelector(".avatar");
  const initials = getWorkerInitials();

  if (nameNode) nameNode.textContent = mockWorker.name;
  if (emailNode) emailNode.textContent = mockWorker.email;
  if (avatarNode) avatarNode.textContent = initials;
}

function loadAssignmentsFromStore() {
  if (!window.MockDataAPI) {
    return;
  }

  const assignments = window.MockDataAPI.list("assignments");
  const complaints = window.MockDataAPI.list("complaints");
  const complaintsById = new Map(complaints.map((item) => [item.id, item]));
  const workerContext = getWorkerHierarchyContext().worker;
  const workerId = workerContext?.id || mockWorker.id;
  const workerName = workerContext?.name || mockWorker.name;

  const scopedAssignments = assignments.filter(
    (assignment) => assignment.assigneeId === workerId || assignment.assignee === workerName,
  );

  if (scopedAssignments.length === 0) {
    assignmentsData = [];
    return;
  }

  assignmentsData = scopedAssignments.map((assignment) => {
    const linkedComplaint = complaintsById.get(assignment.complaintId);
    const normalizedStatus = assignment.status === "Rejected" ? "Pending" : assignment.status;

    if (assignment.status === "Rejected") {
      syncAssignmentUpdate(assignment.id, {
        status: "Pending",
        remarks: "",
        proofMedia: [],
        completedAt: null,
      });

      if (assignment.complaintId) {
        window.MockDataAPI.update("complaints", assignment.complaintId, {
          status: "pending",
          resolutionSubmittedAt: null,
          resolutionSummary: "",
          resolutionMedia: [],
          latestWorkerUpdate: "",
          lastUpdatedAt: null,
          workStartedAt: null,
        });
      }
    }

    return {
    id: assignment.id,
    complaintId: assignment.complaintId,
    issueDescription: assignment.issueDescription,
    category: assignment.category,
    location: assignment.location,
    assignedDate: assignment.assignedDate,
    priority: assignment.priority,
    status: normalizedStatus,
    details: assignment.details,
    citizenName: assignment.citizenName,
    citizenContact: assignment.citizenContact,
    remarks: assignment.remarks,
    assignee: assignment.assignee,
    assigneeId: assignment.assigneeId,
    officerId: assignment.officerId,
    headId: assignment.headId,
    proofMedia: normalizeMediaList(assignment.proofMedia),
    complaintMedia: normalizeMediaList(linkedComplaint?.media),
    resolutionMedia: normalizeMediaList(linkedComplaint?.resolutionMedia),
  };
  });
}

function syncAssignmentUpdate(taskId, partial) {
  if (!window.MockDataAPI) {
    return;
  }

  window.MockDataAPI.update("assignments", taskId, partial);
}

function syncAssignmentDelete(taskId) {
  if (!window.MockDataAPI) {
    return;
  }

  window.MockDataAPI.remove("assignments", taskId);
}

function syncComplaintByTask(taskId, partial) {
  if (!window.MockDataAPI) {
    return;
  }

  const task = assignmentsData.find((item) => item.id === taskId);
  if (!task?.complaintId) {
    return;
  }

  window.MockDataAPI.update("complaints", task.complaintId, partial);
}

const WORKER_PAGE_STATE_KEY = "urbanity.fieldworker.lastPage";
const WORKER_ALLOWED_PAGES = [
  "dashboard",
  "assigned-tasks",
  "in-progress",
  "completed",
  "profile",
];

const WORKER_DEFAULT_PERMISSIONS = {
  assignments: ["read", "update"],
  profile: ["read", "update"],
};

const WORKER_PAGE_ACCESS = {
  dashboard: { module: "assignments", action: "read" },
  "assigned-tasks": { module: "assignments", action: "read" },
  "in-progress": { module: "assignments", action: "read" },
  completed: { module: "assignments", action: "read" },
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
const workerPermissions = roleContext.permissions || WORKER_DEFAULT_PERMISSIONS;

if (
  roleContext.role !== "field_worker" &&
  roleContext.role !== "domain_admin_dept_head" &&
  roleContext.role !== "super_user_admin"
) {
  showWorkerToast("Access denied: This portal is only for Field Worker role. Redirecting to sign in.", "error");
  window.setTimeout(() => {
    window.location.href = "../Authentication/auth.html";
  }, 900);
}

applySessionUserToWorker();

function persistWorkerPage(page) {
  sessionStorage.setItem(WORKER_PAGE_STATE_KEY, page);
}

function hasPermission(moduleName, action) {
  const wildcard = workerPermissions["*"] || [];
  const moduleAccess = workerPermissions[moduleName] || [];
  return wildcard.includes(action) || moduleAccess.includes(action);
}

function hasPageAccess(page) {
  if (!WORKER_ALLOWED_PAGES.includes(page)) {
    return false;
  }

  const config = WORKER_PAGE_ACCESS[page];
  if (!config) {
    return false;
  }

  return hasPermission(config.module, config.action);
}

function getFirstAccessibleWorkerPage() {
  const first = WORKER_ALLOWED_PAGES.find((page) => hasPageAccess(page));
  return first || "dashboard";
}

function applyWorkerRoleRendering() {
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.style.display = hasPageAccess(item.dataset.page) ? "" : "none";
  });
}

function getSavedWorkerPage() {
  const saved = sessionStorage.getItem(WORKER_PAGE_STATE_KEY);
  if (!saved) {
    return getFirstAccessibleWorkerPage();
  }
  return hasPageAccess(saved) ? saved : getFirstAccessibleWorkerPage();
}

function signOut() {
  sessionStorage.removeItem("urbanityRoleContext");
  sessionStorage.removeItem("urbanityRole");
  sessionStorage.removeItem("urbanityRoleLabel");
  sessionStorage.removeItem("urbanityCurrentUser");
  sessionStorage.removeItem(WORKER_PAGE_STATE_KEY);
  window.location.href = "../Landing Page/landingpage.html";
}

let currentPage = "dashboard";
let currentFilters = {
  status: "all",
  priority: "all",
};
let selectedTask = null;

// Navigation
function navigateTo(page) {
  if (!hasPageAccess(page)) {
    return;
  }

  currentPage = page;

  // Update active nav item
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
    if (item.dataset.page === page) {
      item.classList.add("active");
    }
  });

  // Hide dropdown
  document.getElementById("dropdownMenu").classList.remove("show");

  // Render page
  renderPage();
  persistWorkerPage(page);
}

// Toggle dropdown
function toggleDropdown() {
  document.getElementById("dropdownMenu").classList.toggle("show");
}

// Close dropdown when clicking outside
document.addEventListener("click", function (event) {
  const dropdown = document.getElementById("dropdownMenu");
  const profileBtn = document.querySelector(".profile-dropdown");

  if (!profileBtn.contains(event.target) && !dropdown.contains(event.target)) {
    dropdown.classList.remove("show");
  }
});

// Get filtered tasks
function getFilteredTasks() {
  let tasks = assignmentsData.filter(
    (task) => task.assigneeId === mockWorker.id || task.assignee === mockWorker.name,
  );

  if (currentPage === "assigned-tasks") {
    tasks = tasks.filter((t) => t.status === "Pending");
  } else if (currentPage === "in-progress") {
    tasks = tasks.filter((t) => t.status === "In Progress");
  } else if (currentPage === "completed") {
    tasks = tasks.filter((t) => t.status === "Completed");
  }

  if (currentFilters.status !== "all") {
    tasks = tasks.filter((t) => t.status === currentFilters.status);
  }

  if (currentFilters.priority !== "all") {
    tasks = tasks.filter((t) => t.priority === currentFilters.priority);
  }

  return tasks;
}

// Get category color
function getCategoryColor(category) {
  const colors = {
    Roads: "badge-blue",
    Electricity: "badge-orange",
    Water: "badge-cyan",
    Sanitation: "badge-green",
    Other: "badge-blue",
  };
  return colors[category] || "badge-blue";
}

// Get priority color
function getPriorityColor(priority) {
  const colors = {
    High: "badge-red",
    Medium: "badge-orange",
    Low: "badge-green",
  };
  return colors[priority];
}

// Get status color
function getStatusColor(status) {
  const colors = {
    Pending: "badge-orange",
    "In Progress": "badge-blue",
    Completed: "badge-green",
  };
  return colors[status];
}

// Render dashboard
function renderDashboard() {
  const workerTasks = assignmentsData.filter(
    (task) => task.assigneeId === mockWorker.id || task.assignee === mockWorker.name,
  );
  const assignedTasks = workerTasks.filter(
    (t) => t.status === "Pending",
  ).length;
  const inProgress = workerTasks.filter(
    (t) => t.status === "In Progress",
  ).length;
  const completed = workerTasks.filter((t) => t.status === "Completed").length;
  mockWorker.totalCompleted = completed;
  const rating = mockWorker.rating;

  return `
                <div class="page-header">
                    <h1 class="page-title">My Tasks - ${mockWorker.department} Department</h1>
                    <p class="page-subtitle">View and update your assigned civic issues.</p>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-content">
                            <div class="stat-icon" style="background-color: #dbeafe; color: #2563eb;">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                                </svg>
                            </div>
                            <div>
                                <p class="stat-value">${assignedTasks}</p>
                                <p class="stat-label">Assigned Tasks</p>
                            </div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-content">
                            <div class="stat-icon" style="background-color: #fed7aa; color: #ea580c;">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            </div>
                            <div>
                                <p class="stat-value">${inProgress}</p>
                                <p class="stat-label">In Progress</p>
                            </div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-content">
                            <div class="stat-icon" style="background-color: #d1fae5; color: #16a34a;">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            </div>
                            <div>
                                <p class="stat-value">${completed}</p>
                                <p class="stat-label">Completed</p>
                            </div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-content">
                            <div class="stat-icon" style="background-color: #fef3c7; color: #ca8a04;">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                                </svg>
                            </div>
                            <div>
                                <p class="stat-value">${rating}</p>
                                <p class="stat-label">Rating</p>
                            </div>
                        </div>
                    </div>
                </div>

                ${renderTasksTable(true)}
            `;
}

// Render tasks table
function renderTasksTable(showFilters) {
  const tasks = getFilteredTasks();

  let filtersHtml = "";
  if (showFilters) {
    filtersHtml = `
                    <div class="filters">
                        <div class="select-wrapper">
                            <select class="select" onchange="updateFilter('status', this.value)">
                                <option value="all" ${currentFilters.status === "all" ? "selected" : ""}>All Status</option>
                                <option value="Pending" ${currentFilters.status === "Pending" ? "selected" : ""}>Pending</option>
                                <option value="In Progress" ${currentFilters.status === "In Progress" ? "selected" : ""}>In Progress</option>
                                <option value="Completed" ${currentFilters.status === "Completed" ? "selected" : ""}>Completed</option>
                            </select>
                            <svg class="select-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </div>

                        <div class="select-wrapper">
                            <select class="select" onchange="updateFilter('priority', this.value)">
                                <option value="all" ${currentFilters.priority === "all" ? "selected" : ""}>All Priority</option>
                                <option value="High" ${currentFilters.priority === "High" ? "selected" : ""}>High</option>
                                <option value="Medium" ${currentFilters.priority === "Medium" ? "selected" : ""}>Medium</option>
                                <option value="Low" ${currentFilters.priority === "Low" ? "selected" : ""}>Low</option>
                            </select>
                            <svg class="select-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </div>
                    </div>
                `;
  }

  let tableRows = "";
  if (tasks.length === 0) {
    tableRows = `
                    <tr>
                        <td colspan="8" class="empty-state">No tasks found matching the selected filters.</td>
                    </tr>
                `;
  } else {
    tasks.forEach((task) => {
      let actionsHtml = "";

      if (task.status === "Pending") {
        actionsHtml = `
                            <button class="btn btn-primary" onclick="startAssignmentWork('${task.id}')">Start Work</button>
                            <button class="btn btn-outline" onclick="openModal('${task.id}')">View Details</button>
                            <button class="btn btn-outline" onclick="deleteAssignment('${task.id}')">Delete</button>
                        `;
      } else if (task.status === "In Progress") {
        actionsHtml = `
                            <button class="btn btn-orange" onclick="updateAssignmentProgress('${task.id}')">Update</button>
                            <button class="btn btn-success" onclick="completeAssignment('${task.id}')">Complete</button>
                            <button class="btn btn-outline" onclick="openModal('${task.id}')">View Details</button>
                            <button class="btn btn-outline" onclick="deleteAssignment('${task.id}')">Delete</button>
                        `;
      } else {
        actionsHtml = `
                            <button class="btn btn-outline" onclick="openModal('${task.id}')">View Details</button>
                            <button class="btn btn-outline" onclick="deleteAssignment('${task.id}')">Delete</button>
                        `;
      }

      tableRows += `
                        <tr>
                            <td>#${task.id}</td>
                            <td>${task.issueDescription}</td>
                            <td><span class="badge ${getCategoryColor(task.category)}">${task.category}</span></td>
                            <td>${task.location}</td>
                            <td>${task.assignedDate}</td>
                            <td><span class="badge ${getPriorityColor(task.priority)}">${task.priority}</span></td>
                            <td><span class="badge ${getStatusColor(task.status)}">${task.status}</span></td>
                            <td><div class="actions">${actionsHtml}</div></td>
                        </tr>
                    `;
    });
  }

  return `
                <div class="table-container">
                    <div class="table-header">
                        <h3 class="table-title">Assigned Issues</h3>
                        ${filtersHtml}
                    </div>

                    <div style="overflow-x: auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Issue Description</th>
                                    <th>Category</th>
                                    <th>Location</th>
                                    <th>Assigned Date</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
}

// Update filter
function updateFilter(type, value) {
  currentFilters[type] = value;
  renderPage();
}

// Render page
function renderPage() {
  const pageContent = document.getElementById("pageContent");

  if (currentPage === "dashboard") {
    pageContent.innerHTML = renderDashboard();
  } else if (currentPage === "assigned-tasks") {
    pageContent.innerHTML = `
                    <div class="page-header">
                        <h1 class="page-title">Assigned Tasks</h1>
                        <p class="page-subtitle">Tasks waiting to be started.</p>
                    </div>
                    ${renderTasksTable(false)}
                `;
  } else if (currentPage === "in-progress") {
    pageContent.innerHTML = `
                    <div class="page-header">
                        <h1 class="page-title">In Progress</h1>
                        <p class="page-subtitle">Tasks currently being worked on.</p>
                    </div>
                    ${renderTasksTable(false)}
                `;
  } else if (currentPage === "completed") {
    pageContent.innerHTML = `
                    <div class="page-header">
                        <h1 class="page-title">Completed</h1>
                        <p class="page-subtitle">Successfully resolved tasks.</p>
                    </div>
                    ${renderTasksTable(false)}
                `;
  } else if (currentPage === "profile") {
    const workerTasks = assignmentsData.filter(
      (task) => task.assigneeId === mockWorker.id || task.assignee === mockWorker.name,
    );
    const inProgressCount = workerTasks.filter(
      (t) => t.status === "In Progress",
    ).length;
    const successRate = 95;

    pageContent.innerHTML = `
                    <div class="page-header">
                        <h1 class="page-title">My Profile</h1>
              <p class="page-subtitle">View your profile information and performance statistics.</p>
                    </div>
            <div class="worker-profile-layout">
              <section class="worker-profile-card worker-profile-info-card">
                <h3 class="worker-profile-section-title">Profile Information</h3>

                <div class="worker-profile-main">
                  <div class="worker-profile-avatar">${getWorkerInitials()}</div>
                  <h4 class="worker-profile-name">${mockWorker.name}</h4>
                  <p class="worker-profile-id">${mockWorker.employeeId}</p>
                </div>

                <div class="worker-profile-contact-list">
                  <div class="worker-profile-contact-item">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l9 6 9-6M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"/>
                    </svg>
                    <span>${mockWorker.email}</span>
                  </div>
                  <div class="worker-profile-contact-item">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a2 2 0 011.894 1.368l1.307 3.92a2 2 0 01-.45 2.11l-1.766 1.766a16.016 16.016 0 006.364 6.364l1.766-1.766a2 2 0 012.11-.45l3.92 1.307A2 2 0 0121 18.72V22a2 2 0 01-2 2h-1C9.163 24 0 14.837 0 4V3a2 2 0 012-2h1z"/>
                    </svg>
                    <span>${mockWorker.phone}</span>
                  </div>
                  <div class="worker-profile-contact-item">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 10.1c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                    </svg>
                    <span>Rating: ${mockWorker.rating}/5.0</span>
                  </div>
                            </div>

                <div class="worker-profile-divider"></div>

                <div>
                  <p class="worker-profile-dept-label">Assigned Department</p>
                  <p class="worker-profile-dept-value">${mockWorker.department} Department</p>
                </div>
                <div style="margin-top: 10px;">
                  <p class="worker-profile-dept-label">Reporting Officer</p>
                  <p class="worker-profile-dept-value">${mockWorker.reportingOfficer}</p>
                </div>
                <div style="margin-top: 10px;">
                  <p class="worker-profile-dept-label">Department Head</p>
                  <p class="worker-profile-dept-value">${mockWorker.departmentHead}</p>
                </div>
              </section>

              <section class="worker-profile-card worker-profile-performance-card">
                <h3 class="worker-profile-section-title">Performance Statistics</h3>
                <p class="worker-profile-performance-subtitle">Your work performance overview</p>

                <div class="worker-profile-stats-grid">
                  <div class="worker-profile-stat-card worker-profile-stat-green">
                    <div class="worker-profile-stat-icon worker-profile-icon-green">
                      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <div>
                      <p class="worker-profile-stat-value worker-profile-stat-value-green">${mockWorker.totalCompleted}</p>
                      <p class="worker-profile-stat-label worker-profile-stat-label-green">Tasks Completed</p>
                    </div>
                  </div>

                  <div class="worker-profile-stat-card worker-profile-stat-blue">
                    <div class="worker-profile-stat-icon worker-profile-icon-blue">
                      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <div>
                      <p class="worker-profile-stat-value worker-profile-stat-value-blue">${inProgressCount}</p>
                      <p class="worker-profile-stat-label worker-profile-stat-label-blue">In Progress</p>
                    </div>
                  </div>

                  <div class="worker-profile-stat-card worker-profile-stat-yellow">
                    <div class="worker-profile-stat-icon worker-profile-icon-yellow">
                      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 10.1c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                      </svg>
                    </div>
                    <div>
                      <p class="worker-profile-stat-value worker-profile-stat-value-yellow">${mockWorker.rating}</p>
                      <p class="worker-profile-stat-label worker-profile-stat-label-yellow">Average Rating</p>
                    </div>
                  </div>

                  <div class="worker-profile-stat-card worker-profile-stat-purple">
                    <div class="worker-profile-stat-icon worker-profile-icon-purple">
                      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15l-3.5 2 1-4-3-2.5 4-.4L12 6l1.5 3.1 4 .4-3 2.5 1 4z"/>
                      </svg>
                    </div>
                    <div>
                      <p class="worker-profile-stat-value worker-profile-stat-value-purple">${successRate}%</p>
                      <p class="worker-profile-stat-label worker-profile-stat-label-purple">Success Rate</p>
                    </div>
                  </div>
                </div>

                <div class="worker-profile-achievements">
                  <h4 class="worker-profile-achievements-title">Recent Achievements</h4>

                  <div class="worker-profile-achievement-item">
                    <span class="worker-profile-achievement-badge worker-profile-achievement-success">Fast Resolver</span>
                    <span class="worker-profile-achievement-text">Completed 5 tasks in one week</span>
                  </div>
                  <div class="worker-profile-achievement-item">
                    <span class="worker-profile-achievement-badge worker-profile-achievement-warning">Top Rated</span>
                    <span class="worker-profile-achievement-text">Maintained 4.5+ rating for 3 months</span>
                  </div>
                  <div class="worker-profile-achievement-item">
                    <span class="worker-profile-achievement-badge worker-profile-achievement-info">Reliable Worker</span>
                    <span class="worker-profile-achievement-text">Zero missed assignments this month</span>
                  </div>
                </div>
              </section>
                    </div>
                `;
  }
}

// Open modal
function openModal(taskId) {
  const task = assignmentsData.find((t) => t.id === taskId);
  if (!task) return;

  selectedTask = task;

  const modalContent = document.getElementById("modalContent");
  modalContent.innerHTML = `
                <div class="modal-section modal-grid">
                    <div>
                        <p class="modal-label">Task ID</p>
                        <p class="modal-value">#${task.id}</p>
                    </div>
                    <div>
                        <p class="modal-label">Date Assigned</p>
                        <p class="modal-value">${task.assignedDate}</p>
                    </div>
                </div>

                <div class="modal-section modal-grid">
                    <div>
                        <p class="modal-label">Category</p>
                        <p><span class="badge ${getCategoryColor(task.category)}">${task.category}</span></p>
                    </div>
                    <div>
                        <p class="modal-label">Priority</p>
                        <p><span class="badge ${getPriorityColor(task.priority)}">${task.priority}</span></p>
                    </div>
                </div>

                <div class="modal-section">
                    <p class="modal-label">Issue</p>
                    <p class="modal-value">${task.issueDescription}</p>
                </div>

                <div class="modal-section">
                    <p class="modal-label">Description</p>
                    <p class="modal-value">${task.details}</p>
                </div>

                <div class="modal-section">
                    <p class="modal-label">Location</p>
                    <p class="modal-value">${task.location}</p>
                </div>

                ${
                  task.complaintMedia && task.complaintMedia.length
                  ? `
                <div class="modal-section">
                  <p class="modal-label">Complaint Media</p>
                  ${renderMediaPreviewHtml(task.complaintMedia)}
                </div>
                `
                  : ""
                }

                ${
                  task.proofMedia && task.proofMedia.length
                  ? `
                <div class="modal-section">
                  <p class="modal-label">Uploaded Proof</p>
                  ${renderMediaPreviewHtml(task.proofMedia)}
                </div>
                `
                  : ""
                }

                ${
                  task.remarks
                    ? `
                <div class="modal-section">
                    <p class="modal-label">Remarks</p>
                    <p class="modal-value">${task.remarks}</p>
                </div>
                `
                    : ""
                }
            `;

  const actionBtn = document.getElementById("modalActionBtn");
  if (task.status === "Pending") {
    actionBtn.textContent = "Start Work";
    actionBtn.className = "modal-btn modal-btn-blue";
  } else if (task.status === "In Progress") {
    actionBtn.textContent = "Update Progress";
    actionBtn.className = "modal-btn modal-btn-orange";
  } else {
    actionBtn.textContent = "Close";
    actionBtn.className = "modal-btn modal-btn-gray";
  }

  document.getElementById("modalOverlay").classList.add("show");
}

function startAssignmentWork(taskId) {
  const task = assignmentsData.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  task.status = "In Progress";
  syncAssignmentUpdate(taskId, { status: task.status });
  syncComplaintByTask(taskId, {
    status: "in-progress",
    workStartedAt: new Date().toLocaleString(),
  });
  renderPage();
}

async function updateAssignmentProgress(taskId) {
  const task = assignmentsData.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  const result = await showWorkerDialog({
    title: "Update Progress Remarks",
    message: "Add progress remarks for this assignment.",
    confirmText: "Save",
    cancelText: "Cancel",
    inputValue: task.remarks || "",
  });

  if (!result.confirmed) {
    return;
  }

  task.remarks = (result.value || "").trim();
  syncAssignmentUpdate(taskId, { remarks: task.remarks });
  syncComplaintByTask(taskId, {
    status: "in-progress",
    latestWorkerUpdate: task.remarks,
    lastUpdatedAt: new Date().toLocaleString(),
  });
  showWorkerToast("Progress updated.", "success");
  renderPage();
}

async function completeAssignment(taskId) {
  const task = assignmentsData.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  const formResult = await showAssignmentCompletionForm(task);
  if (!formResult.confirmed) {
    return;
  }

  task.status = "Completed";
  task.remarks = formResult.completionNote;
  task.workDetails = formResult.workDetails;
  task.materials = formResult.materials;
  task.proofMedia = normalizeMediaList(formResult.proofMedia);

  const completionSummary = [task.remarks, task.workDetails].filter(Boolean).join(" ");

  syncAssignmentUpdate(taskId, {
    status: task.status,
    remarks: task.remarks,
    workDetails: task.workDetails,
    materials: task.materials,
    proofMedia: task.proofMedia,
    completedAt: new Date().toLocaleString(),
  });
  syncComplaintByTask(taskId, {
    status: "in-progress",
    resolutionSubmittedAt: new Date().toLocaleString(),
    resolutionSummary: completionSummary || "Task marked completed by field worker.",
    resolutionMedia: task.proofMedia,
  });
  showWorkerToast("Assignment completed and sent for officer verification.", "success");
  renderPage();
}

async function deleteAssignment(taskId) {
  const result = await showWorkerDialog({
    title: "Delete Assignment",
    message: "Delete this assignment? This action cannot be undone.",
    confirmText: "Delete",
    cancelText: "Cancel",
  });

  if (!result.confirmed) {
    return;
  }

  assignmentsData = assignmentsData.filter((item) => item.id !== taskId);
  syncAssignmentDelete(taskId);
  showWorkerToast("Assignment deleted.", "success");
  renderPage();
}

// Close modal
function closeModal(event) {
  if (event && event.target.id !== "modalOverlay") return;
  document.getElementById("modalOverlay").classList.remove("show");
  selectedTask = null;
}

// Handle modal action
function handleModalAction() {
  if (!selectedTask) return;

  if (selectedTask.status === "Completed") {
    closeModal();
  } else if (selectedTask.status === "Pending") {
    startAssignmentWork(selectedTask.id);
    closeModal();
  } else if (selectedTask.status === "In Progress") {
    updateAssignmentProgress(selectedTask.id);
    closeModal();
  }
}

// Setup nav listeners
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", function (e) {
    e.preventDefault();
    navigateTo(this.dataset.page);
  });
});

// Initial render
document.querySelector(".signout-btn")?.addEventListener("click", signOut);
document.querySelector(".dropdown-signout")?.addEventListener("click", signOut);

applyWorkerRoleRendering();
loadAssignmentsFromStore();

currentPage = getSavedWorkerPage();
renderPage();
