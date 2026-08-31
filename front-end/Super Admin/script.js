(function () {
  "use strict";

  const state = { user: null, communities: [], towers: [], floors: [], apartments: [], users: [], workers: [], complaints: [], report: null, dashboard: null, previewUrl: null };
  let activePage = "dashboard";
  const titles = { dashboard: "Platform Dashboard", communities: "Communities", admins: "Community Admin Accounts", users: "Platform Users", workforce: "Workforce", complaints: "Global Complaints", reports: "Reports", profile: "Profile" };
  const api = (path, options = {}) => window.UrbanityApi.apiRequest(path, { ...options, redirectOnUnauthorized: false });
  const data = (response) => response?.data;
  const escape = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const notice = (message, success) => { const node = document.getElementById("notice"); node.textContent = message || ""; node.classList.toggle("success", Boolean(success)); };
  const count = (items, predicate) => items.filter(predicate).length;
  const table = (headings, rows) => rows.length ? `<div class="table-wrap"><table><thead><tr>${headings.map(escape).map((item) => `<th>${item}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>` : `<p class="muted">No records were returned by the backend.</p>`;
  const row = (values) => `<tr>${values.map((value) => `<td>${value}</td>`).join("")}</tr>`;

  function communityName(id) { return state.communities.find((item) => item.id === id)?.name || "Unassigned"; }
  function communityForUser(user) {
    if (user.communityId) return user.communityId;
    if (user.towerId) return state.towers.find((tower) => tower.id === user.towerId)?.communityId;
    if (user.apartmentId) { const apartment = state.apartments.find((item) => item.id === user.apartmentId); const floor = state.floors.find((item) => item.id === apartment?.floorId); return state.towers.find((item) => item.id === floor?.towerId)?.communityId; }
    return undefined;
  }
  function roleLabel(role) { return String(role || "").replaceAll("_", " "); }
  function renderTopbar() {
    const user = state.user || {};
    const initials = (user.name || "Super Admin").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const openComplaints = state.complaints.filter((item) => !["RESOLVED", "REVIEWED", "CLOSED"].includes(item.status)).length;
    const unprofiledWorkers = state.users.filter((item) => item.role === "MAINTENANCE_WORKER" && !state.workers.some((worker) => worker.userId === item.id)).length;
    const notifications = [
      openComplaints && { icon: "!", title: `${openComplaints} open complaint${openComplaints === 1 ? "" : "s"}`, detail: "Review the current complaint queue." },
      unprofiledWorkers && { icon: "i", title: `${unprofiledWorkers} worker account${unprofiledWorkers === 1 ? "" : "s"} need a profile`, detail: "Complete workforce setup from the Workforce workspace." },
      { icon: "✓", title: "Platform data is up to date", detail: "Live data is loaded from Urbanity services." },
    ].filter(Boolean);
    document.getElementById("topbar-avatar").textContent = initials || "SA";
    document.getElementById("profile-menu-name").textContent = user.name || "Urbanity Administrator";
    document.getElementById("profile-menu-email").textContent = user.email || "Account unavailable";
    document.getElementById("notifications-list").innerHTML = notifications.map((item) => `<article class="notification-item"><span class="notification-icon">${escape(item.icon)}</span><div><b>${escape(item.title)}</b><p>${escape(item.detail)}</p></div></article>`).join("");
    document.getElementById("notification-count").textContent = `${notifications.length} unread`;
    document.getElementById("notification-dot").classList.toggle("hidden", notifications.length === 0);
  }
  function renderDashboard() {
    const metrics = state.dashboard || {};
    const hierarchy = metrics.hierarchy || {};
    const complaints = metrics.complaints || {};
    const workforce = metrics.workforce || {};
    const users = metrics.users || {};
    const cards = [
      [hierarchy.communities, "Communities", "community"], [hierarchy.towers, "Towers", "tower"], [hierarchy.apartments, "Apartments", "apartment"],
      [users.RESIDENT || 0, "Residents", "resident"], [users.COMMUNITY_ADMIN || 0, "Community Admins", "admin"], [users.MAINTENANCE_WORKER || 0, "Maintenance Workers", "worker"],
      [complaints.total, "Complaints", "complaint"], [workforce.total, "Worker profiles", "workforce"], [workforce.completedWorkCount, "Completed work", "complete"], [workforce.averageRating, "Average worker rating", "rating"],
    ];
    const icons = {
      community: '<path d="M3 21h18M5 21V9l7-4 7 4v12M9 21v-5h6v5M9 12h.01M15 12h.01"/>', tower: '<path d="M5 21V4h14v17M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/>', apartment: '<path d="M4 21V5h16v16M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01M10 21v-4h4v4"/>', resident: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>', admin: '<path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4ZM9 12l2 2 4-4"/>', worker: '<path d="M4 21v-3a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8"/>', complaint: '<path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 1 1 8.5-9M8 12h.01M12 12h.01M16 12h.01"/>', workforce: '<path d="M8 6V4h8v2M4 8h16v11H4V8Zm7 4h2"/>', complete: '<path d="m5 12 4 4L19 6"/>', rating: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>'
    };
    const totalComplaints = Number(complaints.total) || 0;
    const status = Object.entries(complaints.byStatus || {}).map(([key, value]) => {
      const amount = Number(value) || 0;
      const width = totalComplaints ? Math.max((amount / totalComplaints) * 100, amount ? 7 : 0) : 0;
      return `<li><div class="status-label"><span>${escape(roleLabel(key))}</span><b>${escape(amount)}</b></div><div class="status-track"><span style="width:${width}%"></span></div></li>`;
    }).join("");
    document.getElementById("dashboard-content").innerHTML = `<div class="dashboard-layout"><section class="dashboard-hero"><div><p class="dashboard-kicker">Platform overview</p><h2>Everything across Urbanity, at a glance.</h2><p>Monitor the community network, workforce capacity, and complaint activity from one authoritative view.</p></div><div class="dashboard-health"><span>Platform health</span><strong>Live</strong><small>Data refreshed from Urbanity services</small></div></section><section class="metric-grid">${cards.map(([value, label, icon]) => `<article class="metric-card metric-${icon}"><span class="metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[icon]}</svg></span><div><b>${escape(value ?? 0)}</b><span>${escape(label)}</span></div></article>`).join("")}</section><section class="complaint-overview"><div class="overview-heading"><div><p class="dashboard-kicker">Resolution pipeline</p><h2>Complaint status distribution</h2></div><div class="complaint-total"><b>${escape(totalComplaints)}</b><span>Total complaints</span></div></div>${status ? `<ul class="status-list">${status}</ul>` : '<p class="muted">No complaint data is available yet.</p>'}</section></div>`;
  }
  function renderCommunities() {
    document.getElementById("communities-content").innerHTML = table(["Community", "Address", "Towers", "Apartments", "Actions"], state.communities.map((community) => {
      const towers = count(state.towers, (tower) => tower.communityId === community.id);
      const towerIds = new Set(state.towers.filter((tower) => tower.communityId === community.id).map((tower) => tower.id));
      const floorIds = new Set(state.floors.filter((floor) => towerIds.has(floor.towerId)).map((floor) => floor.id));
      const apartments = count(state.apartments, (apartment) => floorIds.has(apartment.floorId));
      return row([escape(community.name), escape(community.address), towers, apartments, `<span class="actions"><button type="button" class="secondary" data-edit-community="${escape(community.id)}">Edit</button><button type="button" class="danger" data-delete-community="${escape(community.id)}">Delete</button></span>`]);
    }));
    document.getElementById("admin-community").innerHTML = `<option value="">Select a community</option>${state.communities.map((community) => `<option value="${escape(community.id)}">${escape(community.name)}</option>`).join("")}`;
  }
  function renderAdmins() {
    const admins = state.users.filter((user) => user.role === "COMMUNITY_ADMIN");
    document.getElementById("admins-content").innerHTML = table(["Name", "Email", "Community", "Role"], admins.map((user) => row([escape(user.name), escape(user.email), escape(communityName(user.communityId)), `<span class="badge">${escape(roleLabel(user.role))}</span>`])));
  }
  function renderUsers() { document.getElementById("users-content").innerHTML = table(["Name", "Email", "Role", "Community", "Actions"], state.users.map((user) => row([escape(user.name), escape(user.email), `<span class="badge">${escape(roleLabel(user.role))}</span>`, escape(communityName(communityForUser(user))), `<button type="button" class="secondary" data-user-detail="${escape(user.id)}">View / edit</button>`]))); }
  function renderWorkforce() {
    document.getElementById("workforce-content").innerHTML = table(["Worker", "Community", "Specialization", "Status", "Rating", "Completed", "History", "Actions"], state.workers.map((worker) => { const user = state.users.find((item) => item.id === worker.userId); return row([escape(user?.name || worker.userId), escape(communityName(worker.communityId)), escape(worker.specialization), `<span class="badge">${escape(worker.status)}</span>`, escape(worker.rating), escape(worker.completedWorkCount), escape((worker.workHistory || []).length), `<button type="button" class="secondary" data-worker-detail="${escape(worker.id)}">View</button>`]); }));
    const profiledUsers = new Set(state.workers.map((worker) => worker.userId));
    const candidates = state.users.filter((user) => user.role === "MAINTENANCE_WORKER" && !profiledUsers.has(user.id));
    document.getElementById("worker-user").innerHTML = `<option value="">Select a worker user</option>${candidates.map((user) => `<option value="${escape(user.id)}">${escape(user.name)} · ${escape(communityName(user.communityId))}</option>`).join("")}`;
  }
  function renderComplaints() { document.getElementById("complaints-content").innerHTML = table(["Title", "Community", "Type", "Status", "Work type", "Responsible authority", "Worker", "Created", "Actions"], state.complaints.map((complaint) => { const worker = state.workers.find((item) => item.id === complaint.assignedWorkerId); return row([escape(complaint.title), escape(communityName(complaint.communityId)), escape(complaint.type), `<span class="badge">${escape(complaint.status)}</span>`, escape(complaint.requiredWorkType), escape(complaint.responsibleUserName), escape(worker ? state.users.find((user) => user.id === worker.userId)?.name : "Not assigned"), escape(new Date(complaint.createdAt).toLocaleString()), `<button type="button" class="secondary" data-complaint-detail="${escape(complaint.id)}">View details</button>`]); })); }
  function renderReports() { const report = state.report || {}; const summary = state.communities.map((community) => { const towers = state.towers.filter((item) => item.communityId === community.id); const towerIds = new Set(towers.map((item) => item.id)); const floorIds = new Set(state.floors.filter((item) => towerIds.has(item.towerId)).map((item) => item.id)); const complaints = state.complaints.filter((item) => item.communityId === community.id); return row([escape(community.name), towers.length, count(state.apartments, (item) => floorIds.has(item.floorId)), count(state.users, (user) => user.role === "RESIDENT" && communityForUser(user) === community.id), count(state.workers, (worker) => worker.communityId === community.id), complaints.length, count(complaints, (item) => !["RESOLVED", "REVIEWED", "CLOSED"].includes(item.status))]); }); document.getElementById("reports-content").innerHTML = `<p class="muted">Generated ${escape(report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "")}</p><div class="stats">${[[report.complaints?.total, "Complaints"], [report.workforce?.total, "Workers"], [report.hierarchy?.communities, "Communities"], [report.workforce?.completedWorkCount, "Completed work"]].map(([value, label]) => `<article class="stat"><b>${escape(value ?? 0)}</b><span>${escape(label)}</span></article>`).join("")}</div><h2>Required work types</h2><p>${Object.entries(report.requiredWorkTypes || {}).map(([key, value]) => `<span class="badge">${escape(key)}: ${escape(value)}</span>`).join(" ") || "No report data."}</p><h2>Community summary</h2>${table(["Community", "Towers", "Apartments", "Residents", "Workers", "Complaints", "Open"], summary)}`; }
  function renderProfile() {
    const user = state.user || {};
    const name = user.name || "Urbanity Administrator";
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "SA";
    const metrics = state.dashboard || {};
    const openComplaints = state.complaints.filter((complaint) => !["RESOLVED", "REVIEWED", "CLOSED"].includes(complaint.status)).length;
    document.getElementById("profile-content").innerHTML = `<div class="profile-page"><section class="profile-hero profile-card"><div class="profile-avatar-large">${escape(initials)}</div><div><p class="profile-eyebrow">Authenticated account</p><h2>${escape(name)}</h2><p>${escape(user.email || "Email unavailable")}</p><span class="profile-role">${escape(roleLabel(user.role || "SUPER_ADMIN"))}</span></div><span class="profile-verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m5 12 4 4L19 6"/></svg> Verified session</span></section><div class="profile-content-grid"><div class="profile-main-column"><section class="profile-details profile-card"><div class="profile-section-heading"><div><p class="profile-eyebrow">Account details</p><h3>Your platform identity</h3></div><div class="profile-heading-actions"><span>Managed by Urbanity</span><button class="secondary" type="button" data-edit-profile>Edit profile</button></div></div><dl class="profile-detail-list"><div><dt>Full name</dt><dd>${escape(name)}</dd></div><div><dt>Email address</dt><dd>${escape(user.email || "Not available")}</dd></div><div><dt>Access level</dt><dd>${escape(roleLabel(user.role || "SUPER_ADMIN"))}</dd></div><div><dt>Account scope</dt><dd>All communities and platform operations</dd></div></dl></section><section class="profile-activity profile-card"><div class="profile-section-heading"><div><p class="profile-eyebrow">Platform context</p><h3>Your administrative overview</h3></div></div><div class="profile-metric-grid"><div><b>${escape(metrics.hierarchy?.communities ?? state.communities.length)}</b><span>Communities</span></div><div><b>${escape(state.users.length)}</b><span>Platform users</span></div><div><b>${escape(openComplaints)}</b><span>Open complaints</span></div></div></section></div><aside class="profile-side-column"><section class="profile-security profile-card"><span class="profile-security-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path stroke-linecap="round" stroke-linejoin="round" d="m9 12 2 2 4-4"/></svg></span><div><p class="profile-eyebrow">Session security</p><h3>Secure platform access</h3><p>Your identity and permissions are confirmed by the Urbanity service for this active session.</p></div></section><section class="profile-actions profile-card"><p class="profile-eyebrow">Quick actions</p><h3>Continue managing</h3><p>Jump directly to key platform workspaces.</p><button class="secondary" type="button" data-profile-page="communities">Manage communities</button><button class="secondary" type="button" data-profile-page="complaints">Review complaints</button><button class="secondary" type="button" data-profile-page="reports">Open reports</button></section></aside></div></div>`;
  }
  function editProfile() {
    const user = state.user || {};
    openDetail("Edit profile", `<form id="profile-edit-form"><label>Name<input name="name" value="${escape(user.name || "")}" required maxlength="200"></label><label>Email<input name="email" type="email" value="${escape(user.email || "")}" required maxlength="320"></label><button type="submit">Save changes</button></form>`);
    document.getElementById("profile-edit-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try {
        await api(`/users/${state.user.id}`, { method: "PATCH", body: { name: values.name.trim(), email: values.email.trim() } });
        state.user = await window.UrbanityApi.getCurrentUser();
        document.getElementById("session-profile").textContent = `${state.user.email} · Super Admin`;
        renderProfile();
        closeDetail();
        notice("Profile updated.", true);
      } catch (error) { notice(error.message || "Unable to update your profile."); }
    });
  }
  function renderAll() { renderDashboard(); renderCommunities(); renderAdmins(); renderUsers(); renderWorkforce(); renderComplaints(); renderReports(); renderProfile(); }

  async function loadData() {
    const results = await Promise.all([api("/dashboard/summary"), api("/reports/overview"), api("/communities"), api("/towers"), api("/floors"), api("/apartments"), api("/users"), api("/workforce/workers"), api("/complaints")]);
    [state.dashboard, state.report, state.communities, state.towers, state.floors, state.apartments, state.users, state.workers, state.complaints] = results.map(data);
    renderAll();
    renderTopbar();
  }
  async function refreshSummary() {
    const [dashboard, report] = await Promise.all([api("/dashboard/summary"), api("/reports/overview")]);
    state.dashboard = data(dashboard);
    state.report = data(report);
    renderDashboard();
    renderReports();
    renderProfile();
    renderTopbar();
    openPage(activePage);
  }
  function updateRecord(collection, record) {
    const index = state[collection].findIndex((item) => item.id === record.id);
    if (index >= 0) state[collection][index] = record;
    else state[collection].push(record);
  }
  function openPage(name) { activePage = name; document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === name)); document.querySelectorAll(".nav").forEach((button) => button.classList.toggle("active", button.dataset.page === name)); document.getElementById("page-title").textContent = titles[name]; }
  async function refresh() { notice("Refreshing platform data…"); try { await loadData(); notice("Platform data refreshed.", true); } catch (error) { notice(error.message || "Unable to load platform data."); } }
  const panelValues = (panel) => Object.fromEntries([...panel.querySelectorAll("[name]")].map((field) => [field.name, field.value]));
  const clearPanel = (panel) => panel.querySelectorAll("input, textarea, select").forEach((field) => { field.value = ""; });
  async function createCommunity(panel) { const values = panelValues(panel); const button = panel.querySelector("[data-create-community]"); if (!values.name?.trim() || !values.address?.trim()) return notice("Name and address are required."); button.disabled = true; try { const created = data(await api("/communities", { method: "POST", body: values })); updateRecord("communities", created); clearPanel(panel); renderCommunities(); await refreshSummary(); notice("Community created.", true); } catch (error) { notice(error.message || "Unable to create community."); } finally { button.disabled = false; } }
  async function createAdmin(panel) { const values = panelValues(panel); const button = panel.querySelector("[data-create-admin]"); if (!values.name?.trim() || !values.email?.trim() || !values.password || !values.communityId) return notice("Complete all required Community Admin fields."); button.disabled = true; try { const created = data(await api("/users", { method: "POST", body: { ...values, role: "COMMUNITY_ADMIN" } })); updateRecord("users", created); clearPanel(panel); renderAdmins(); renderUsers(); renderWorkforce(); await refreshSummary(); notice("Community Admin created.", true); } catch (error) { notice(error.message || "Unable to create the Community Admin account."); } finally { button.disabled = false; } }
  async function createWorkerProfile(panel) { const values = panelValues(panel); const button = panel.querySelector("[data-create-worker]"); if (!values.userId || !values.specialization) return notice("Select a worker user and specialization."); button.disabled = true; try { const created = data(await api("/workforce/workers", { method: "POST", body: values })); updateRecord("workers", created); clearPanel(panel); renderWorkforce(); await refreshSummary(); notice("Worker profile created.", true); } catch (error) { notice(error.message || "Unable to create worker profile."); } finally { button.disabled = false; } }
  function closeDetail() { if (state.previewUrl) { URL.revokeObjectURL(state.previewUrl); state.previewUrl = null; } document.getElementById("detail-modal").classList.add("hidden"); document.getElementById("detail-content").innerHTML = ""; }
  function openDetail(title, content) { closeDetail(); document.getElementById("detail-title").textContent = title; document.getElementById("detail-content").innerHTML = content; document.getElementById("detail-modal").classList.remove("hidden"); }
  async function viewUser(id) { const user = data(await api(`/users/${id}`)); openDetail("User details", `<p><b>${escape(user.name)}</b></p><p>${escape(user.email)}</p><p>${escape(roleLabel(user.role))} · ${escape(communityName(communityForUser(user)))}</p><div class="actions"><button type="button" id="edit-user">Edit name and email</button><button type="button" class="danger" id="delete-user">Delete</button></div>`); document.getElementById("edit-user").onclick = async () => { const name = window.prompt("Name", user.name); const email = window.prompt("Email", user.email); if (!name?.trim() || !email?.trim()) return; try { const updated = data(await api(`/users/${id}`, { method: "PATCH", body: { name: name.trim(), email: email.trim() } })); updateRecord("users", updated); closeDetail(); renderAdmins(); renderUsers(); renderWorkforce(); await refreshSummary(); notice("User updated.", true); } catch (error) { notice(error.message || "Unable to update user."); } }; document.getElementById("delete-user").onclick = async () => { if (!window.confirm("Delete this user? This cannot be undone.")) return; try { await api(`/users/${id}`, { method: "DELETE" }); state.users = state.users.filter((item) => item.id !== id); closeDetail(); renderAdmins(); renderUsers(); renderWorkforce(); await refreshSummary(); notice("User deleted.", true); } catch (error) { notice(error.message || "Unable to delete user."); } }; }
  async function viewWorker(id) { const worker = data(await api(`/workforce/workers/${id}`)); const user = state.users.find((item) => item.id === worker.userId); openDetail("Worker profile", `<p><b>${escape(user?.name || "Maintenance Worker")}</b></p><p>${escape(communityName(worker.communityId))} · ${escape(worker.specialization)}</p><p>Status: ${escape(worker.status)} · Rating: ${escape(worker.rating)} · Completed: ${escape(worker.completedWorkCount)}</p><p class="hint">Work history: ${escape((worker.workHistory || []).join(", ") || "No completed work yet")}</p>`); }
  async function viewComplaint(id) { const complaint = data(await api(`/complaints/${id}`)); const [attachmentsResult, reviewResult] = await Promise.allSettled([api(`/complaints/${id}/attachments`), api(`/complaints/${id}/review`)]); const attachments = attachmentsResult.status === "fulfilled" ? data(attachmentsResult.value) : []; const review = reviewResult.status === "fulfilled" ? data(reviewResult.value) : null; const history = (complaint.statusHistory || []).map((item) => `<li>${escape(item.status)} · ${escape(new Date(item.changedAt).toLocaleString())}</li>`).join(""); openDetail("Complaint details", `<p><b>${escape(complaint.title)}</b></p><p>${escape(complaint.description)}</p><p>${escape(communityName(complaint.communityId))} · ${escape(complaint.type)} · ${escape(complaint.status)}</p><p>Work type: ${escape(complaint.requiredWorkType)} · Responsible authority: ${escape(complaint.responsibleUserName)}</p><p>Created: ${escape(new Date(complaint.createdAt).toLocaleString())}</p><h3>Status history</h3><ul>${history || "<li>No history available.</li>"}</ul><h3>Attachments</h3>${attachments.length ? attachments.map((item) => `<p>${escape(item.originalName)} · ${escape(item.mimeType)} · ${escape(item.size)} bytes <button class="secondary" data-preview-attachment="${escape(item.id)}">Preview</button></p>`).join("") : "<p class=\"muted\">No attachments.</p>"}<h3>Resident review</h3>${review ? `<p>${escape(review.rating)} / 5${review.feedback ? ` · ${escape(review.feedback)}` : ""}</p><p class="hint">${escape(new Date(review.createdAt).toLocaleString())}</p>` : "<p class=\"muted\">Awaiting resident review.</p>"}`); document.querySelectorAll("[data-preview-attachment]").forEach((button) => button.onclick = async () => { if (state.previewUrl) URL.revokeObjectURL(state.previewUrl); const blob = await api(`/complaints/${id}/attachments/${button.dataset.previewAttachment}`, { responseType: "blob" }); state.previewUrl = URL.createObjectURL(blob); const preview = document.getElementById("attachment-preview") || document.createElement("img"); preview.id = "attachment-preview"; preview.className = "attachment-preview"; preview.src = state.previewUrl; document.getElementById("detail-content").append(preview); }); }
  async function detailAction(event) { const button = event.target.closest("button"); if (!button) return; event.preventDefault(); event.stopPropagation(); try { if (button.dataset.userDetail) await viewUser(button.dataset.userDetail); if (button.dataset.workerDetail) await viewWorker(button.dataset.workerDetail); if (button.dataset.complaintDetail) await viewComplaint(button.dataset.complaintDetail); } catch (error) { notice(error.message || "Unable to load details."); } }
  async function communityAction(event) { const editId = event.target.dataset.editCommunity; const deleteId = event.target.dataset.deleteCommunity; if (!editId && !deleteId) return; event.preventDefault(); event.stopPropagation(); if (deleteId) { if (!window.confirm("Delete this community? This may affect associated towers, residents, and workers.")) return; try { await api(`/communities/${deleteId}`, { method: "DELETE" }); state.communities = state.communities.filter((item) => item.id !== deleteId); renderCommunities(); await refreshSummary(); notice("Community deleted.", true); } catch (error) { notice(error.message || "Unable to delete community."); } } if (editId) { const community = state.communities.find((item) => item.id === editId); const name = window.prompt("Community name", community?.name); if (!name?.trim()) return; try { const updated = data(await api(`/communities/${editId}`, { method: "PATCH", body: { name: name.trim() }})); updateRecord("communities", updated); renderCommunities(); await refreshSummary(); notice("Community updated.", true); } catch (error) { notice(error.message || "Unable to update community."); } } }
  async function initialize() {
    if (!window.UrbanityApi?.getAccessToken()) { window.UrbanityApi?.logout(); return; }
    try {
      state.user = await window.UrbanityApi.getCurrentUser();
      if (state.user?.role !== "SUPER_ADMIN") { window.UrbanityApi.logout(); return; }
      document.getElementById("session-profile").textContent = `${state.user.email} · Super Admin`;
      await refresh();
    } catch (error) { if (error?.status !== 401) notice(error.message || "Unable to verify your session."); }
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("click", (event) => {
      const actionButton = event.target.closest("#communities-content button, #users-content button, #workforce-content button, #complaints-content button");
      if (actionButton) event.preventDefault();
    }, true);
    document.addEventListener("submit", (event) => {
      event.preventDefault();
    }, true);
    document.querySelectorAll(".nav").forEach((button) => button.addEventListener("click", () => openPage(button.dataset.page)));
    document.querySelectorAll(".refresh").forEach((button) => button.addEventListener("click", refresh));
    document.querySelector("[data-create-community]").addEventListener("click", () => createCommunity(document.getElementById("community-form")));
    document.querySelector("[data-create-admin]").addEventListener("click", () => createAdmin(document.getElementById("admin-form")));
    document.querySelector("[data-create-worker]").addEventListener("click", () => createWorkerProfile(document.getElementById("worker-form")));
    document.getElementById("communities-content").addEventListener("click", communityAction);
    document.getElementById("users-content").addEventListener("click", detailAction);
    document.getElementById("workforce-content").addEventListener("click", detailAction);
    document.getElementById("complaints-content").addEventListener("click", detailAction);
    document.getElementById("profile-content").addEventListener("click", (event) => {
      if (event.target.closest("[data-edit-profile]")) {
        editProfile();
        return;
      }
      const button = event.target.closest("[data-profile-page]");
      if (button) openPage(button.dataset.profilePage);
    });
    document.getElementById("detail-close").addEventListener("click", closeDetail);
    document.getElementById("detail-modal").addEventListener("click", (event) => { if (event.target.id === "detail-modal") closeDetail(); });
    document.getElementById("logout").addEventListener("click", () => window.UrbanityApi.logout());
    const closeTopbarMenus = () => {
      document.querySelectorAll(".topbar-menu").forEach((menu) => menu.classList.add("hidden"));
      document.querySelectorAll("#notifications-toggle, #profile-toggle").forEach((button) => button.setAttribute("aria-expanded", "false"));
    };
    const toggleTopbarMenu = (buttonId, menuId) => {
      const button = document.getElementById(buttonId);
      const menu = document.getElementById(menuId);
      const opening = menu.classList.contains("hidden");
      closeTopbarMenus();
      menu.classList.toggle("hidden", !opening);
      button.setAttribute("aria-expanded", String(opening));
    };
    document.getElementById("notifications-toggle").addEventListener("click", () => toggleTopbarMenu("notifications-toggle", "notifications-menu"));
    document.getElementById("profile-toggle").addEventListener("click", () => toggleTopbarMenu("profile-toggle", "profile-menu"));
    document.getElementById("mark-notifications-read").addEventListener("click", () => { document.getElementById("notification-count").textContent = "All caught up"; document.getElementById("notification-dot").classList.add("hidden"); });
    document.querySelector("[data-topbar-page='profile']").addEventListener("click", () => { openPage("profile"); closeTopbarMenus(); });
    document.getElementById("topbar-help").addEventListener("click", () => { notice("For platform support, contact the Urbanity administration team."); closeTopbarMenus(); });
    document.getElementById("topbar-logout").addEventListener("click", () => window.UrbanityApi.logout());
    document.addEventListener("click", (event) => { if (!event.target.closest(".topbar-dropdown")) closeTopbarMenus(); });
    initialize();
  });
})();
