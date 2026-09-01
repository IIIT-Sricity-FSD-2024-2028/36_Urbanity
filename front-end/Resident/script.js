const RESIDENT_PAGE_KEY = "urbanity.resident.lastPage";
const WORK_TYPES = [
  "PLUMBING",
  "ELECTRICAL",
  "CARPENTRY",
  "HVAC",
  "LIFT_MAINTENANCE",
  "CLEANING",
  "GENERAL_MAINTENANCE",
];
const ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
];
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_COMPLAINT_ATTACHMENTS = 4;
const STATUS_LABELS = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  REVIEWED: "Reviewed",
  CLOSED: "Closed",
};
const state = {
  page: "dashboard",
  hierarchy: null,
  complaints: [],
  activeComplaint: null,
};

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const friendly = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const api = (path, options) => window.UrbanityApi.apiRequest(path, options);

function notify(message, type = "info") {
  if (window.UIFeedback?.toast)
    return window.UIFeedback.toast({ scope: "resident", message, type });
  let host = document.querySelector(".urbanity-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "urbanity-toast-host";
    document.body.append(host);
  }
  const toast = document.createElement("div");
  toast.className = `urbanity-toast urbanity-toast-${["success", "error"].includes(type) ? type : "info"}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  host.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function currentUser() {
  return window.UrbanityApi.getStoredUser();
}
function locationText() {
  const { apartment, floor, tower, community } = state.hierarchy || {};
  return (
    [
      community?.name,
      tower?.name,
      floor?.label,
      apartment?.label || apartment?.apartmentNumber,
    ]
      .filter(Boolean)
      .join(" · ") || "Hierarchy unavailable"
  );
}

function hierarchyItems() {
  const { apartment, floor, tower, community } = state.hierarchy || {};
  return [
    ["Community", community?.name],
    ["Tower", tower?.name],
    ["Floor", floor?.label],
    ["Apartment", apartment?.label || apartment?.apartmentNumber],
  ];
}

function hierarchyTrail(compact = false) {
  const content = hierarchyItems()
    .map(
      ([label, value], index) =>
        `<div class="hierarchy-step"><span class="hierarchy-index">${index + 1}</span><div><small>${label}</small><strong>${escapeHtml(value || "—")}</strong></div></div>`,
    )
    .join("");
  return `<div class="hierarchy-trail${compact ? " hierarchy-trail-compact" : ""}">${content}</div>`;
}
function setHeader() {
  const user = state.hierarchy?.user || currentUser() || {};
  const name = user.name || user.email || "Resident";
  document.querySelector(".profile-btn-name").textContent = name;
  document.querySelector(".profile-btn-email").textContent = user.email || "";
  document.querySelector(".profile-avatar").textContent = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function loadResidentData() {
  const [hierarchyResponse, complaintsResponse] = await Promise.all([
    api("/users/me/hierarchy"),
    api("/complaints"),
  ]);
  state.hierarchy = hierarchyResponse.data;
  state.complaints = complaintsResponse.data || [];
  setHeader();
}

function statusPill(status) {
  return `<span class="status-badge status-${String(status || "").toLowerCase()}">${escapeHtml(STATUS_LABELS[status] || friendly(status))}</span>`;
}
function complaintRow(complaint) {
  return `<tr><td><button class="link-button complaint-open" type="button" data-id="${complaint.id}">${escapeHtml(complaint.title)}</button><div class="table-subtext">${escapeHtml(friendly(complaint.type))} · ${escapeHtml(complaint.requiredWorkType ? friendly(complaint.requiredWorkType) : "")}</div></td><td>${statusPill(complaint.status)}</td><td>${escapeHtml(complaint.responsibleUserName || friendly(complaint.responsibleRole))}</td><td>${escapeHtml(formatDate(complaint.updatedAt || complaint.createdAt))}</td></tr>`;
}

function renderDashboard() {
  const total = state.complaints.length;
  const count = (statuses) =>
    state.complaints.filter((item) => statuses.includes(item.status)).length;
  const metrics = [
    ["My Complaints", total, "clipboard"],
    [
      "Submitted",
      count(["SUBMITTED", "UNDER_REVIEW", "ASSIGNED"]),
      "submitted",
    ],
    ["In Progress", count(["IN_PROGRESS"]), "progress"],
    ["Resolved", count(["RESOLVED", "REVIEWED", "CLOSED"]), "resolved"],
  ];
  return `<section class="resident-hero"><div><p class="eyebrow">Resident workspace</p><h1>Welcome back, ${escapeHtml(state.hierarchy?.user?.name?.split(" ")[0] || "Resident")}.</h1><p>Track requests and keep your apartment maintenance moving.</p></div><button class="btn btn-primary" data-go="raise-issue">Raise Complaint</button></section>
  <div class="metric-grid">${metrics.map(([label, value, icon]) => `<article class="metric-card metric-${icon}"><span class="metric-icon" aria-hidden="true">${icon === "resolved" ? "✓" : icon === "progress" ? "↻" : icon === "submitted" ? "↑" : "▤"}</span><div><b>${value}</b><span>${label}</span></div></article>`).join("")}</div>
  <div class="dashboard-grid"><section class="content-card apartment-card"><div class="apartment-heading"><div><p class="eyebrow">Your registered location</p><h2>My Apartment</h2></div><span class="apartment-mark" aria-hidden="true">⌂</span></div>${hierarchyTrail()}<p class="muted location-address">${escapeHtml(state.hierarchy?.community?.address || "Address unavailable")}</p></section>
  <section class="content-card recent-card"><div class="section-header"><div><p class="eyebrow">Latest activity</p><h2>Recent Complaints</h2></div><button class="btn btn-secondary" data-go="my-complaints">View all</button></div>${renderComplaintTable(state.complaints.slice(0, 5))}</section></div>`;
}

function renderComplaintTable(complaints) {
  if (!complaints.length)
    return `<div class="empty-state"><span class="empty-state-icon" aria-hidden="true">▤</span><h3>No complaints yet</h3><p>When you raise a maintenance request, its progress will appear here.</p><button class="btn btn-primary" data-go="raise-issue">Raise your first complaint</button></div>`;
  return `<div class="table-container"><table><thead><tr><th>Complaint</th><th>Status</th><th>Responsible Authority</th><th>Updated</th></tr></thead><tbody>${complaints.map(complaintRow).join("")}</tbody></table></div>`;
}

function options(values) {
  return values
    .map(
      (value) =>
        `<option value="${value}">${escapeHtml(friendly(value))}</option>`,
    )
    .join("");
}
function renderRaiseComplaint() {
  return `<div class="page-header"><div><p class="eyebrow">New maintenance request</p><h1>Raise Complaint</h1><p>Tell the maintenance team what needs attention.</p></div></div><div class="form-layout"><section class="content-card form-card"><div class="location-summary"><span class="location-icon" aria-hidden="true">⌂</span><div class="location-summary-content"><small>Service location</small>${hierarchyTrail(true)}<span>Securely derived from your resident profile</span></div></div><form id="complaintForm" class="issue-form"><div class="form-grid"><div class="form-group"><label for="complaintType">Complaint Type</label><select id="complaintType" required><option value="">Select type</option><option value="APARTMENT">Apartment Complaint</option><option value="TOWER">Tower Complaint</option><option value="COMMUNITY">Community Complaint</option></select></div><div class="form-group"><label for="workType">Required Work Type</label><select id="workType" required><option value="">Select work type</option>${options(WORK_TYPES)}</select></div></div><div class="form-group"><label for="complaintTitle">Title</label><input id="complaintTitle" maxlength="200" placeholder="Briefly describe the issue" required></div><div class="form-group"><label for="complaintDescription">Description</label><textarea id="complaintDescription" maxlength="2000" placeholder="Include useful details such as when the issue started and where it can be found" required></textarea></div><div class="form-group"><label for="complaintAttachments">Upload photos or videos <span class="optional-label">(optional)</span></label><label class="media-upload" for="complaintAttachments"><span class="media-upload-icon" aria-hidden="true">＋</span><span><strong>Choose photos or videos</strong><small>JPEG, PNG, WebP, MP4, or WebM · up to 5 MB each · maximum 4 files</small></span></label><input class="media-upload-input" id="complaintAttachments" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple><div id="complaintAttachmentPreview" class="media-preview-list" aria-live="polite"></div></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-go="dashboard">Cancel</button><button class="btn btn-primary" type="submit">Submit Complaint</button></div></form></section><aside class="content-card guidance-card"><p class="eyebrow">Before you submit</p><h2>Help us resolve it faster</h2><ul><li>Choose the closest matching work type.</li><li>Describe the exact location and symptoms.</li><li>Add clear photos or a short video when helpful.</li></ul></aside></div>`;
}

function renderComplaints() {
  return `<div class="page-header"><div><p class="eyebrow">Maintenance history</p><h1>My Complaints</h1><p>Only requests associated with your authenticated account are shown.</p></div><button class="btn btn-primary" data-go="raise-issue">Raise Complaint</button></div><section class="content-card table-card"><div class="section-header"><div><h2>All requests</h2><p class="muted">${state.complaints.length} complaint${state.complaints.length === 1 ? "" : "s"} in your account</p></div></div>${renderComplaintTable(state.complaints)}</section>`;
}

function renderReviews() {
  const resolved = state.complaints.filter(
    (item) => item.status === "RESOLVED" || item.status === "REVIEWED",
  );
  return `<div class="page-header"><div><p class="eyebrow">Service feedback</p><h1>Reviews</h1><p>Rate completed maintenance work on resolved complaints.</p></div></div><section class="content-card table-card">${resolved.length ? renderComplaintTable(resolved) : `<div class="empty-state"><span class="empty-state-icon" aria-hidden="true">☆</span><h3>No reviews waiting</h3><p>Resolved complaints that are ready for your feedback will appear here.</p></div>`}</section>`;
}

function renderProfile() {
  const { user, apartment, floor, tower, community } = state.hierarchy || {};
  const name = user?.name || "Resident";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const details = [
    ["Full name", name],
    ["Email address", user?.email],
    ["Mobile number", user?.phone || "Not provided"],
    ["Community", community?.name],
    ["Tower", tower?.name],
    ["Floor", floor?.label],
    ["Apartment", apartment?.label || apartment?.apartmentNumber],
  ];
  return `<div class="page-header"><div><p class="eyebrow">Account & location</p><h1>Resident Profile</h1><p>Update your contact details and review your registered apartment.</p></div><button class="btn btn-primary" type="button" data-edit-profile>Edit profile</button></div><div class="profile-page"><section class="profile-hero"><div class="profile-avatar-large">${escapeHtml(initials)}</div><div><p class="eyebrow">Authenticated resident</p><h2>${escapeHtml(name)}</h2><p>${escapeHtml(user?.email || "Email unavailable")}</p><span class="profile-role">Resident</span></div><span class="verified-badge">✓ Verified session</span></section><section class="content-card profile-details"><div class="section-header"><div><p class="eyebrow">Profile details</p><h2>Your Urbanity account</h2></div><span class="managed-badge">Location managed by Community Admin</span></div><dl class="profile-info">${details.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value || "—")}</dd></div>`).join("")}</dl></section><section class="security-card"><span aria-hidden="true">✓</span><div><h3>Secure resident access</h3><p>Your identity, complaint ownership, and location are verified by Urbanity services for this session.</p></div></section></div>`;
}

function closeProfileEditModal() {
  document.getElementById("residentProfileEditModal")?.remove();
}

function openProfileEditModal() {
  const user = state.hierarchy?.user;
  if (!user?.id) return notify("Your profile is unavailable.", "error");
  closeProfileEditModal();
  const overlay = document.createElement("div");
  overlay.id = "residentProfileEditModal";
  overlay.className = "resident-profile-modal";
  overlay.innerHTML = `<section class="resident-profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="residentProfileEditTitle"><header><div><p class="eyebrow">Personal details</p><h2 id="residentProfileEditTitle">Edit profile</h2><p>Update the contact information associated with your account.</p></div><button class="modal-close-btn" type="button" data-close-profile aria-label="Close edit profile modal">&times;</button></header><form id="residentProfileEditForm"><div class="resident-profile-modal-body"><div class="form-group"><label for="residentProfileName">Full name</label><input id="residentProfileName" name="name" value="${escapeHtml(user.name || "")}" maxlength="100" autocomplete="name" required></div><div class="form-group"><label for="residentProfileEmail">Email address</label><input id="residentProfileEmail" name="email" type="email" value="${escapeHtml(user.email || "")}" maxlength="100" autocomplete="email" required></div><div class="form-group"><label for="residentProfilePhone">Mobile number</label><input id="residentProfilePhone" name="phone" type="tel" value="${escapeHtml(user.phone || "")}" maxlength="20" autocomplete="tel" placeholder="e.g. +91 98765 43210"><p class="field-hint">Optional. Include your country code when applicable.</p></div><div class="locked-location"><span aria-hidden="true">⌂</span><div><strong>Registered location</strong><p>${escapeHtml(locationText())}</p><small>Location changes are managed by your Community Admin.</small></div></div></div><footer><button class="btn btn-secondary" type="button" data-close-profile>Cancel</button><button class="btn btn-primary" type="submit">Save changes</button></footer></form></section>`;
  overlay.addEventListener("click", (event) => {
    if (
      event.target === overlay ||
      event.target.closest("[data-close-profile]")
    )
      closeProfileEditModal();
  });
  overlay.querySelector("form").addEventListener("submit", submitProfileEdit);
  document.body.append(overlay);
  overlay.querySelector("input").focus();
}

async function submitProfileEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const submitButton = form.querySelector('[type="submit"]');
  const body = {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim(),
  };
  if (!body.name || !body.email)
    return notify("Name and email are required.", "error");
  submitButton.disabled = true;
  submitButton.textContent = "Saving…";
  try {
    const updated = (
      await api(`/users/${state.hierarchy.user.id}`, { method: "PATCH", body })
    ).data;
    window.UrbanityApi.saveSession(
      window.UrbanityApi.getAccessToken(),
      updated,
    );
    await loadResidentData();
    closeProfileEditModal();
    renderPage("profile");
    notify("Profile updated successfully.", "success");
  } catch (error) {
    notify(error.message || "Unable to update your profile.", "error");
    submitButton.disabled = false;
    submitButton.textContent = "Save changes";
  }
}

function renderPage(page = state.page) {
  state.page = page;
  sessionStorage.setItem(RESIDENT_PAGE_KEY, page);
  const pages = {
    dashboard: renderDashboard,
    "raise-issue": renderRaiseComplaint,
    "my-complaints": renderComplaints,
    feedback: renderReviews,
    profile: renderProfile,
  };
  document.getElementById("pageContent").innerHTML = (
    pages[page] || renderDashboard
  )();
  document
    .querySelectorAll(".nav-item")
    .forEach((item) =>
      item.classList.toggle("active", item.dataset.page === page),
    );
  bindPageEvents();
}

async function submitComplaint(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('[type="submit"]');
  const type = document.getElementById("complaintType").value;
  const requiredWorkType = document.getElementById("workType").value;
  const title = document.getElementById("complaintTitle").value.trim();
  const description = document
    .getElementById("complaintDescription")
    .value.trim();
  const attachments = [
    ...document.getElementById("complaintAttachments").files,
  ];
  if (!type || !requiredWorkType || !title || !description)
    return notify("Please complete all complaint fields.", "error");
  const attachmentError = validateComplaintAttachments(attachments);
  if (attachmentError) return notify(attachmentError, "error");
  submitButton.disabled = true;
  submitButton.textContent = "Submitting…";
  try {
    const response = await api("/complaints", {
      method: "POST",
      body: { type, title, description, requiredWorkType },
    });
    const uploadResults = await Promise.allSettled(
      attachments.map((file) =>
        uploadComplaintAttachment(response.data.id, file),
      ),
    );
    const failedUploads = uploadResults.filter(
      (result) => result.status === "rejected",
    ).length;
    await loadResidentData();
    notify(
      failedUploads
        ? `Complaint submitted, but ${failedUploads} attachment${failedUploads === 1 ? "" : "s"} could not be uploaded.`
        : attachments.length
          ? "Complaint and attachments submitted successfully."
          : "Complaint submitted successfully.",
      failedUploads ? "error" : "success",
    );
    renderPage("my-complaints");
    openComplaint(response.data.id);
  } catch (error) {
    notify(error.message || "Unable to submit complaint.", "error");
    submitButton.disabled = false;
    submitButton.textContent = "Submit Complaint";
  }
}

function validateComplaintAttachments(files) {
  if (files.length > MAX_COMPLAINT_ATTACHMENTS)
    return `Select no more than ${MAX_COMPLAINT_ATTACHMENTS} files.`;
  const unsupported = files.find(
    (file) => !ATTACHMENT_TYPES.includes(file.type),
  );
  if (unsupported)
    return `${unsupported.name} is not a supported photo or video format.`;
  const oversized = files.find((file) => file.size > MAX_ATTACHMENT_SIZE);
  if (oversized) return `${oversized.name} exceeds the 5 MB limit.`;
  return "";
}

async function uploadComplaintAttachment(complaintId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return api(`/complaints/${complaintId}/attachments`, {
    method: "POST",
    body: formData,
  });
}

function renderComplaintAttachmentPreview(event) {
  const files = [...event.currentTarget.files];
  const preview = document.getElementById("complaintAttachmentPreview");
  const error = validateComplaintAttachments(files);
  if (error) {
    event.currentTarget.value = "";
    preview.innerHTML = "";
    return notify(error, "error");
  }
  preview.innerHTML = files
    .map(
      (file) =>
        `<div class="media-preview-item"><span class="media-kind">${file.type.startsWith("video/") ? "VIDEO" : "PHOTO"}</span><div><strong>${escapeHtml(file.name)}</strong><small>${(file.size / 1024 / 1024).toFixed(2)} MB</small></div></div>`,
    )
    .join("");
}

async function openComplaint(id) {
  try {
    const [complaintResponse, attachmentsResponse] = await Promise.all([
      api(`/complaints/${id}`),
      api(`/complaints/${id}/attachments`),
    ]);
    state.activeComplaint = complaintResponse.data;
    state.activeComplaint.attachments = attachmentsResponse.data || [];
    let review = null;
    try {
      review = (
        await api(`/complaints/${id}/review`, { redirectOnUnauthorized: false })
      ).data;
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    state.activeComplaint.review = review;
    showComplaintModal(state.activeComplaint);
  } catch (error) {
    notify(error.message || "Unable to load complaint details.", "error");
  }
}

function showComplaintModal(complaint) {
  document.getElementById("modalIssueTitle").textContent = complaint.title;
  document.getElementById("modalStatusBadge").textContent =
    STATUS_LABELS[complaint.status] || friendly(complaint.status);
  document.getElementById("modalStatusBadge").className =
    `modal-status-badge status-badge status-${String(complaint.status || "").toLowerCase()}`;
  document.getElementById("modalCategoryText").textContent = friendly(
    complaint.type,
  );
  const reviewSection = complaint.review
    ? `<section class="modal-description-section"><h3>Your Review</h3><p>${"★".repeat(complaint.review.rating)}${"☆".repeat(5 - complaint.review.rating)} · ${escapeHtml(complaint.review.feedback || "No feedback provided")}</p><p>${escapeHtml(formatDate(complaint.review.createdAt))}</p></section>`
    : complaint.status === "RESOLVED"
      ? `<section class="modal-description-section"><h3>Review completed work</h3><form id="reviewForm"><label>Rating</label><select id="reviewRating" required><option value="">Select 1–5</option>${[1, 2, 3, 4, 5].map((rating) => `<option value="${rating}">${rating} star${rating > 1 ? "s" : ""}</option>`).join("")}</select><label>Feedback (optional)</label><textarea id="reviewFeedback" maxlength="2000"></textarea><button class="raise-issue-btn" type="submit">Submit Review</button></form></section>`
      : "";
  document.getElementById("modalBodyContent").innerHTML =
    `<div class="modal-details"><div class="modal-detail-row"><div><div class="modal-detail-label">Location</div><div class="modal-detail-value">${escapeHtml(locationText())}</div></div></div><div class="modal-detail-row"><div><div class="modal-detail-label">Required Work</div><div class="modal-detail-value">${escapeHtml(friendly(complaint.requiredWorkType))}</div></div></div><div class="modal-detail-row"><div><div class="modal-detail-label">Responsible Authority</div><div class="modal-detail-value">${escapeHtml(complaint.responsibleUserName || friendly(complaint.responsibleRole))}</div></div></div><div class="modal-description-section"><div class="modal-detail-label">Description</div><div class="modal-description-text">${escapeHtml(complaint.description)}</div></div><section class="modal-description-section"><h3>Status History</h3>${(complaint.statusHistory || []).map((entry) => `<p>${escapeHtml(STATUS_LABELS[entry.status] || friendly(entry.status))} · ${escapeHtml(formatDate(entry.changedAt))} · ${escapeHtml(friendly(entry.changedByRole))}</p>`).join("")}</section><section class="modal-description-section"><h3>Attachments</h3><form id="attachmentForm"><input id="attachmentFile" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"><button class="link-button" type="submit">Upload media</button></form><div id="attachmentList">${complaint.attachments.length ? complaint.attachments.map((attachment) => `<div class="attachment-item" data-attachment="${attachment.id}">${escapeHtml(attachment.originalName)} (${Math.ceil(attachment.size / 1024)} KB) <span class="attachment-preview"></span></div>`).join("") : "No attachments."}</div></section>${reviewSection}</div>`;
  document.getElementById("issueModal").classList.add("active");
  document
    .getElementById("attachmentForm")
    ?.addEventListener("submit", uploadAttachment);
  document
    .getElementById("reviewForm")
    ?.addEventListener("submit", submitReview);
  loadAttachmentPreviews(complaint.id, complaint.attachments);
}

async function loadAttachmentPreviews(complaintId, attachments) {
  for (const attachment of attachments) {
    try {
      const blob = await api(
        `/complaints/${complaintId}/attachments/${attachment.id}`,
        { responseType: "blob" },
      );
      const preview = document.createElement(
        attachment.mimeType.startsWith("video/") ? "video" : "img",
      );
      preview.src = URL.createObjectURL(blob);
      if (preview instanceof HTMLVideoElement) preview.controls = true;
      else preview.alt = attachment.originalName;
      preview.style.cssText =
        "width:80px;height:60px;object-fit:cover;margin-left:8px;vertical-align:middle;";
      document
        .querySelector(
          `[data-attachment="${attachment.id}"] .attachment-preview`,
        )
        ?.append(preview);
    } catch (_error) {
      /* Individual previews are optional; metadata remains visible. */
    }
  }
}

async function uploadAttachment(event) {
  event.preventDefault();
  const file = document.getElementById("attachmentFile").files[0];
  if (!file) return notify("Select an image to upload.", "error");
  const validationError = validateComplaintAttachments([file]);
  if (validationError) return notify(validationError, "error");
  const formData = new FormData();
  formData.append("file", file);
  try {
    await api(`/complaints/${state.activeComplaint.id}/attachments`, {
      method: "POST",
      body: formData,
    });
    notify("Image uploaded.", "success");
    openComplaint(state.activeComplaint.id);
  } catch (error) {
    notify(error.message || "Unable to upload image.", "error");
  }
}

async function submitReview(event) {
  event.preventDefault();
  const rating = Number(document.getElementById("reviewRating").value);
  const feedback = document.getElementById("reviewFeedback").value.trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return notify("Select a rating from 1 to 5.", "error");
  try {
    await api(`/complaints/${state.activeComplaint.id}/review`, {
      method: "POST",
      body: feedback ? { rating, feedback } : { rating },
    });
    await loadResidentData();
    notify("Review submitted.", "success");
    openComplaint(state.activeComplaint.id);
  } catch (error) {
    notify(error.message || "Unable to submit review.", "error");
  }
}

function closeIssueModal() {
  document.getElementById("issueModal").classList.remove("active");
}
function bindPageEvents() {
  document
    .querySelectorAll("[data-go]")
    .forEach((button) =>
      button.addEventListener("click", () => renderPage(button.dataset.go)),
    );
  document
    .querySelectorAll(".complaint-open")
    .forEach((button) =>
      button.addEventListener("click", () => openComplaint(button.dataset.id)),
    );
  document
    .getElementById("complaintForm")
    ?.addEventListener("submit", submitComplaint);
  document
    .getElementById("complaintAttachments")
    ?.addEventListener("change", renderComplaintAttachmentPreview);
  document
    .querySelector("[data-edit-profile]")
    ?.addEventListener("click", openProfileEditModal);
}

function bindShell() {
  document
    .querySelectorAll(".nav-item, .profile-menu-item[data-page]")
    .forEach((item) =>
      item.addEventListener("click", (event) => {
        event.preventDefault();
        renderPage(item.dataset.page);
      }),
    );
  document
    .querySelectorAll(".sign-out-btn, .profile-signout-btn")
    .forEach((button) =>
      button.addEventListener("click", () => {
        sessionStorage.removeItem(RESIDENT_PAGE_KEY);
        window.UrbanityApi.logout();
      }),
    );
  document.getElementById("issueModal").addEventListener("click", (event) => {
    if (event.target.id === "issueModal") closeIssueModal();
  });
  const notificationButton = document.getElementById("notificationBtn");
  const notificationDropdown = document.getElementById("notificationDropdown");
  const profileButton = document.getElementById("profileBtn");
  const profileDropdown = document.getElementById("profileDropdown");
  notificationButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    profileDropdown?.classList.remove("active");
    notificationDropdown?.classList.toggle("active");
  });
  profileButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    notificationDropdown?.classList.remove("active");
    profileDropdown?.classList.toggle("active");
  });
  document.getElementById("markAllRead")?.addEventListener("click", () => {
    document.getElementById("notificationBadge").textContent = "0";
    document.getElementById("notificationList").innerHTML =
      '<div class="dropdown-empty">You are all caught up.</div>';
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".notification-container"))
      notificationDropdown?.classList.remove("active");
    if (!event.target.closest(".profile-container"))
      profileDropdown?.classList.remove("active");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeIssueModal();
      closeProfileEditModal();
      notificationDropdown?.classList.remove("active");
      profileDropdown?.classList.remove("active");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.UrbanityApi?.getAccessToken())
    return window.UrbanityApi?.logout();
  bindShell();
  document.getElementById("pageContent").innerHTML =
    '<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><h2>Loading your resident workspace</h2><p>Fetching your apartment and maintenance requests…</p></div>';
  try {
    await loadResidentData();
    const saved = sessionStorage.getItem(RESIDENT_PAGE_KEY);
    renderPage(
      [
        "dashboard",
        "raise-issue",
        "my-complaints",
        "feedback",
        "profile",
      ].includes(saved)
        ? saved
        : "dashboard",
    );
  } catch (error) {
    const message = error.message || "Unable to load the Resident portal.";
    notify(message, "error");
    document.getElementById("pageContent").innerHTML =
      `<div class="empty-state error-state"><span class="empty-state-icon" aria-hidden="true">!</span><h3>We could not load your workspace</h3><p>${escapeHtml(message)}</p><button class="btn btn-secondary" type="button" onclick="window.location.reload()">Try again</button></div>`;
  }
});
