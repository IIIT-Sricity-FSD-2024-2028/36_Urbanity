(function initializeTowerRepPortal() {
  'use strict';

  const state = {
    currentPage: 'dashboard',
    hierarchy: null,
    complaints: [],
    workers: [],
    residentContexts: new Map(),
    loading: { dashboard: false, complaints: false, workers: false },
    activeComplaint: null,
    selectedWorker: null,
    workforceRefreshTimer: null,
  };

  const api = (path, options = {}) => window.UrbanityApi.apiRequest(path, { redirectOnUnauthorized: false, ...options });

  function toast(message, type = 'info') {
    const host = document.getElementById('toastHost');
    if (!host) return;
    const id = `toast-${Date.now()}`;
    const colors = { info: 'urbanity-toast-info', success: 'urbanity-toast-success', error: 'urbanity-toast-error' };
    const tpl = `<div class="urbanity-toast ${colors[type] || colors.info}" id="${id}">${message}</div>`;
    host.insertAdjacentHTML('beforeend', tpl);
    const el = document.getElementById(id);
    if (el) setTimeout(() => el.remove(), 4000);
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function labelEnum(value) {
    return String(value ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try { return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return dateStr; }
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try { return new Date(dateStr).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch { return dateStr; }
  }

  function statusBadge(status) {
    const map = {
      SUBMITTED: '<span class="status-badge status-submitted">Submitted</span>',
      UNDER_REVIEW: '<span class="status-badge status-review">Under Review</span>',
      ASSIGNED: '<span class="status-badge status-assigned">Assigned</span>',
      IN_PROGRESS: '<span class="status-badge status-progress">In Progress</span>',
      RESOLVED: '<span class="status-badge status-resolved">Resolved</span>',
      REVIEWED: '<span class="status-badge status-reviewed">Reviewed</span>',
      CLOSED: '<span class="status-badge status-closed">Closed</span>',
    };
    return map[status] || `<span class="status-badge">${escapeHtml(labelEnum(status))}</span>`;
  }

  function typeBadge(type) {
    return `<span class="category-badge">${escapeHtml(labelEnum(type))}</span>`;
  }

  function workerLabel(worker) { return worker?.name || 'Maintenance Worker'; }
  function workerReference(worker) { return worker?.userId ? `Worker profile · ${worker.userId.slice(0, 8)}` : 'Community worker profile'; }

  function complaintContext(complaint) { return state.residentContexts.get(complaint.residentId) || {}; }
  function apartmentLabel(context) { return context.apartment?.number || context.apartment?.name || context.apartment?.id?.slice(0, 8) || 'Apartment unavailable'; }
  function residentLabel(context) { return context.user?.name || 'Resident details unavailable'; }
  function activeWorkload(workerId) { return state.complaints.filter((complaint) => complaint.assignedWorkerId === workerId && ['ASSIGNED', 'IN_PROGRESS'].includes(complaint.status)).length; }

  async function hydrateResidentContexts(complaints) {
    const ids = [...new Set(complaints.map((complaint) => complaint.residentId).filter(Boolean))].filter((id) => !state.residentContexts.has(id));
    await Promise.all(ids.map(async (id) => {
      try { state.residentContexts.set(id, (await api(`/users/${id}/resident-hierarchy`)).data || {}); }
      catch { state.residentContexts.set(id, {}); }
    }));
  }

  function getStatusFilter(status) {
    const filter = document.getElementById('complaintStatusFilter')?.value || '';
    if (!filter) return true;
    return status === filter;
  }

  async function loadHierarchy() {
    try {
      const response = await api('/users/me/hierarchy');
      state.hierarchy = response.data;
      applyUserToUI();
    } catch (err) {
      toast('Unable to load user hierarchy. Please sign in again.', 'error');
      console.error('Hierarchy load error:', err);
    }
  }

  function applyUserToUI() {
    if (!state.hierarchy) return;
    const { user, tower, community } = state.hierarchy;
    const name = user?.name || 'Tower Representative';
    const email = user?.email || '';
    const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('userName', name);
    setText('userEmail', email);
    setText('userAvatar', initials);
    document.title = `URBANITY - ${tower?.name || 'Tower Representative'} Portal`;
  }

  async function loadDashboard() {
    if (state.loading.dashboard) return;
    state.loading.dashboard = true;
    showLoading('dashboardLoading', 'dashboardContent', true);

    try {
      const [complaintsRes] = await Promise.all([api('/complaints')]);
      state.complaints = complaintsRes.data || [];
      await hydrateResidentContexts(state.complaints);
      renderDashboard();
      renderNotifications();
    } catch (err) {
      toast('Unable to load dashboard data.', 'error');
      console.error('Dashboard load error:', err);
    } finally {
      state.loading.dashboard = false;
      showLoading('dashboardLoading', 'dashboardContent', false);
    }
  }

  function renderDashboard() {
    const tower = state.hierarchy?.tower;
    const subtitle = document.getElementById('dashboardSubtitle');
    if (subtitle) subtitle.textContent = tower ? `${tower.name} · ${state.hierarchy?.community?.name || ''}` : 'Tower Overview';
    const heroHeading = document.querySelector('#dashboardHero h1');
    if (heroHeading) heroHeading.textContent = `Welcome back, ${(state.hierarchy?.user?.name || 'Representative').split(' ')[0]}.`;

    const c = state.complaints;
    const submitted = c.filter((x) => x.status === 'SUBMITTED').length;
    const underReview = c.filter((x) => x.status === 'UNDER_REVIEW').length;
    const assigned = c.filter((x) => x.status === 'ASSIGNED').length;
    const inProgress = c.filter((x) => x.status === 'IN_PROGRESS').length;
    const resolved = c.filter((x) => ['RESOLVED', 'REVIEWED', 'CLOSED'].includes(x.status)).length;
    const active = c.filter((x) => !['RESOLVED', 'REVIEWED', 'CLOSED'].includes(x.status)).length;

    const statsEl = document.getElementById('dashboardStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon-wrap" style="background:#dbeafe;color:#1e40af;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div class="stat-content"><b>${active}</b><span>Active Complaints</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap" style="background:#fef3c7;color:#92400e;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="stat-content"><b>${submitted}</b><span>New Complaints</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap" style="background:#ede9fe;color:#6b21a8;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5z"/></svg>
          </div>
          <div class="stat-content"><b>${underReview}</b><span>Under Review</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap" style="background:#d1fae5;color:#065f46;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div class="stat-content"><b>${assigned}</b><span>Assigned Complaints</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap" style="background:#e0f2fe;color:#0369a1;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>
          </div>
          <div class="stat-content"><b>${inProgress}</b><span>In Progress</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap" style="background:#dcfce7;color:#166534;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/><path d="M21 12a9 9 0 1 1-4-7.5"/></svg>
          </div>
          <div class="stat-content"><b>${resolved}</b><span>Resolved</span></div>
        </div>
      `;
    }

    const overview = document.getElementById('dashboardOverview');
    if (overview) {
      const resolutionRate = c.length ? Math.round((resolved / c.length) * 100) : 0;
      const common = Object.entries(c.reduce((counts, complaint) => { counts[complaint.requiredWorkType] = (counts[complaint.requiredWorkType] || 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1])[0];
      overview.innerHTML = `<section class="overview-card"><p class="overview-eyebrow">Tower activity overview</p><div class="overview-metrics"><div><b>${c.length}</b><span>Total complaints</span></div><div><b>${resolutionRate}%</b><span>Resolution rate</span></div><div><b>${assigned}</b><span>Assigned</span></div><div><b>${inProgress}</b><span>In progress</span></div><div><b>${common ? escapeHtml(labelEnum(common[0])) : '—'}</b><span>Most common work type</span></div></div><p class="overview-note">Average resolution time is not shown because the backend does not store a completion duration.</p></section>`;
    }

    const recent = [...c].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    const tableEl = document.getElementById('recentComplaintsTable');
    if (tableEl) {
      if (!recent.length) {
        tableEl.innerHTML = '<p class="empty-state">No complaints found for your tower.</p>';
      } else {
        tableEl.innerHTML = `<div class="table-container"><table class="data-table"><thead><tr><th>Complaint</th><th>Type</th><th>Status</th><th>Date</th></tr></thead><tbody>${recent.map((item) => `<tr><td><button type="button" class="btn-link" onclick="openComplaintDetail('${item.id}')">${escapeHtml(item.title)}</button></td><td>${typeBadge(item.type)}</td><td>${statusBadge(item.status)}</td><td>${formatDate(item.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
      }
    }
  }

  async function loadComplaints() {
    if (state.loading.complaints) return;
    state.loading.complaints = true;
    showLoading('complaintsLoading', 'complaintsContent', true);

    try {
      const response = await api('/complaints');
      state.complaints = response.data || [];
      await hydrateResidentContexts(state.complaints);
      renderComplaints();
      renderNotifications();
    } catch (err) {
      toast('Unable to load complaints.', 'error');
      console.error('Complaints load error:', err);
    } finally {
      state.loading.complaints = false;
      showLoading('complaintsLoading', 'complaintsContent', false);
    }
  }

  function renderComplaints() {
    const filter = document.getElementById('complaintStatusFilter')?.value || '';
    const type = document.getElementById('complaintTypeFilter')?.value || '';
    const search = (document.getElementById('complaintSearch')?.value || '').trim().toLowerCase();
    const fromDate = document.getElementById('complaintDateFilter')?.value || '';
    const filtered = state.complaints.filter((complaint) => {
      const context = complaintContext(complaint);
      const searchable = [complaint.id, complaint.title, residentLabel(context), apartmentLabel(context)].join(' ').toLowerCase();
      return (!filter || complaint.status === filter) && (!type || complaint.type === type) && (!search || searchable.includes(search)) && (!fromDate || String(complaint.createdAt || '').slice(0, 10) >= fromDate);
    });
    const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const tableEl = document.getElementById('complaintsTable');
    if (tableEl) {
      if (!sorted.length) {
        tableEl.innerHTML = '<div class="card"><div class="card-content empty-state">No complaints found.</div></div>';
      } else {
        tableEl.innerHTML = `<div class="card"><div class="table-container"><table class="data-table"><thead><tr><th>Complaint</th><th>Resident & apartment</th><th>Type</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>${sorted.map((item) => { const context = complaintContext(item); return `<tr><td><b>${escapeHtml(item.title)}</b><br><small class="text-muted">${escapeHtml(item.id.slice(0, 8))} · ${escapeHtml(item.description || '').slice(0, 54)}${(item.description || '').length > 54 ? '...' : ''}</small></td><td><b>${escapeHtml(residentLabel(context))}</b><br><small class="text-muted">${escapeHtml(apartmentLabel(context))}</small></td><td>${typeBadge(item.type)}</td><td>${statusBadge(item.status)}</td><td>${formatDate(item.createdAt)}</td><td><button type="button" class="btn btn-outline btn-sm" onclick="openComplaintDetail('${item.id}')">View details</button></td></tr>`; }).join('')}</tbody></table></div></div>`;
      }
      tableEl.querySelectorAll('tbody tr').forEach((row, index) => {
        const complaint = sorted[index];
        const actions = row.lastElementChild;
        if (!complaint || !actions) return;
        const extra = document.createElement('div');
        extra.className = 'complaint-actions';
        extra.innerHTML = complaintQueueActions(complaint);
        actions.replaceChildren(extra);
      });
    }
  }

  function complaintQueueActions(complaint) {
    const view = `<button type="button" class="btn btn-outline btn-sm" onclick="openComplaintDetail('${complaint.id}')">View details</button>`;
    if (complaint.status === 'SUBMITTED') return `${view}<button type="button" class="btn btn-primary btn-sm" onclick="openComplaintDetail('${complaint.id}')">Review complaint</button>`;
    if (complaint.status === 'UNDER_REVIEW') return `${view}<button type="button" class="btn btn-primary btn-sm" onclick="openWorkerSelection('${complaint.id}')">Assign worker</button>`;
    if (complaint.status === 'ASSIGNED' || complaint.status === 'IN_PROGRESS') return `${view}<span class="queue-state">Worker progress is active</span>`;
    if (complaint.status === 'RESOLVED') return `${view}<span class="queue-state">Awaiting resident review</span>`;
    if (complaint.status === 'REVIEWED') return `${view}<button type="button" class="btn btn-primary btn-sm" onclick="openComplaintDetail('${complaint.id}')">View review & close</button>`;
    return view;
  }

  function lifecycleGuidance(status) {
    const guidance = { SUBMITTED: 'Review this complaint and move it to Under Review before assigning a Maintenance Worker.', UNDER_REVIEW: 'This complaint is ready for an eligible Maintenance Worker assignment.', ASSIGNED: 'A Maintenance Worker has been assigned. The worker can start work from their portal.', IN_PROGRESS: 'The assigned Maintenance Worker is currently progressing this work.', RESOLVED: 'Work is marked resolved. The resident must submit a review before this complaint can be closed.', REVIEWED: 'The resident review is available. You may now close this complaint.', CLOSED: 'This complaint has completed its authorized lifecycle.' };
    return guidance[status] || 'Current complaint lifecycle status.';
  }

  async function loadWorkers() {
    if (state.loading.workers) return;
    state.loading.workers = true;
    showLoading('workersLoading', 'workersContent', true);

    try {
      const response = await api('/workforce/workers');
      state.workers = response.data || [];
      populateWorkerSpecializations();
      renderWorkers();
    } catch (err) {
      toast('Unable to load workers.', 'error');
      console.error('Workers load error:', err);
    } finally {
      state.loading.workers = false;
      showLoading('workersLoading', 'workersContent', false);
    }
  }

  function renderWorkers() {
    const gridEl = document.getElementById('workersGrid');
    if (!gridEl) return;

    const query = (document.getElementById('workerSearch')?.value || '').trim().toLowerCase();
    const specialization = document.getElementById('workerSpecializationFilter')?.value || '';
    const availability = document.getElementById('workerAvailabilityFilter')?.value || '';
    const workers = state.workers.filter((worker) => (!query || [workerReference(worker), labelEnum(worker.specialization)].join(' ').toLowerCase().includes(query)) && (!specialization || worker.specialization === specialization) && (!availability || worker.status === availability));

    if (!workers.length) {
      gridEl.innerHTML = '<div class="card"><div class="card-content empty-state">No Worker Profiles match the selected filters.</div></div>';
      return;
    }

    gridEl.innerHTML = `<div class="workers-grid">${workers.map((worker) => {
      const statusLabel = worker.status === 'AVAILABLE' ? 'Available' : worker.status === 'BUSY' ? 'Busy' : worker.status === 'ON_LEAVE' ? 'On Leave' : escapeHtml(worker.status);
      const statusClass = worker.status === 'AVAILABLE' ? 'status-available' : worker.status === 'BUSY' ? 'status-busy' : 'status-leave';
      const workload = activeWorkload(worker.id);
      return `<div class="worker-card"><div class="worker-card-header"><div class="worker-avatar">${workerLabel(worker)[0].toUpperCase()}</div><div class="worker-info"><b>${escapeHtml(workerLabel(worker))}</b><small>${escapeHtml(workerReference(worker))}</small></div></div><div class="worker-specialization">${escapeHtml(labelEnum(worker.specialization))}</div><div class="worker-stats"><div class="worker-stat"><span>Status</span><span class="status-badge ${statusClass}">${statusLabel}</span></div><div class="worker-stat"><span>Rating</span><b>${Number(worker.rating || 0).toFixed(1)} / 5</b></div><div class="worker-stat"><span>Completed work</span><b>${worker.completedWorkCount || 0}</b></div><div class="worker-stat"><span>Active tasks in this tower</span><b>${workload}</b></div></div></div>`;
    }).join('')}</div>`;
  }

  function stopWorkforceRefresh() {
    if (state.workforceRefreshTimer) clearInterval(state.workforceRefreshTimer);
    state.workforceRefreshTimer = null;
  }

  function startWorkforceRefresh() {
    stopWorkforceRefresh();
    state.workforceRefreshTimer = setInterval(() => {
      if (state.currentPage === 'workers' && document.visibilityState === 'visible') loadWorkers();
    }, 15000);
  }

  async function refreshTowerInsights() {
    try {
      const [complaintsResponse, workersResponse] = await Promise.all([api('/complaints'), api('/workforce/workers')]);
      state.complaints = complaintsResponse.data || [];
      state.workers = workersResponse.data || [];
      await hydrateResidentContexts(state.complaints);
      if (state.currentPage === 'tower') renderTowerOverview();
      if (state.currentPage === 'residents') renderResidents();
      if (state.currentPage === 'reports') renderReports();
    } catch (err) {
      toast(err.message || 'Unable to load tower insights.', 'error');
    }
  }

  function populateWorkerSpecializations() {
    const select = document.getElementById('workerSpecializationFilter');
    if (!select) return;
    const selected = select.value;
    const specializations = [...new Set(state.workers.map((worker) => worker.specialization).filter(Boolean))];
    select.innerHTML = `<option value="">All specializations</option>${specializations.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelEnum(value))}</option>`).join('')}`;
    select.value = selected;
  }

  function renderNotifications() {
    const pending = state.complaints.filter((complaint) => ['SUBMITTED', 'UNDER_REVIEW'].includes(complaint.status));
    const badge = document.getElementById('notificationBadge');
    const summary = document.getElementById('notificationSummary');
    const list = document.getElementById('notificationList');
    if (badge) { badge.textContent = String(pending.length); badge.classList.toggle('hidden', pending.length === 0); }
    if (summary) summary.textContent = pending.length ? `${pending.length} item${pending.length === 1 ? '' : 's'} awaiting action` : 'No items need review';
    if (!list) return;
    list.innerHTML = pending.length ? pending.slice(0, 4).map((complaint) => `<button type="button" class="notification-item" data-complaint-id="${complaint.id}"><span class="notification-item-title">${escapeHtml(complaint.title)}</span><span>${statusBadge(complaint.status)} · ${escapeHtml(labelEnum(complaint.type))}</span></button>`).join('') : '<p class="notification-empty">Your tower has no complaints awaiting review.</p>';
    list.querySelectorAll('[data-complaint-id]').forEach((button) => button.addEventListener('click', () => { closeNotificationDropdown(); openComplaintDetail(button.dataset.complaintId); }));
  }

  function renderProfile() {
    const { user, tower, community } = state.hierarchy || {};
    const profileEl = document.getElementById('profileContent');
    if (!profileEl) return;

    const name = user?.name || 'Tower Representative';
    const email = user?.email || '';
    const phone = user?.phone || 'Not provided';
    const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    const active = state.complaints.filter((complaint) => ['ASSIGNED', 'IN_PROGRESS'].includes(complaint.status)).length;
    const resolved = state.complaints.filter((complaint) => ['RESOLVED', 'REVIEWED', 'CLOSED'].includes(complaint.status)).length;
    profileEl.innerHTML = `<div class="profile-page"><div class="page-header profile-page-header"><div><p class="section-eyebrow">ACCOUNT & TOWER ASSOCIATION</p><h1 class="page-title">Tower Representative Profile</h1><p class="page-description">Review your authenticated account and assigned tower.</p></div></div><section class="profile-identity-banner"><div class="profile-identity-main"><div class="profile-avatar-lg">${initials}</div><div><p class="profile-role">AUTHENTICATED TOWER REPRESENTATIVE</p><h2 class="profile-name">${escapeHtml(name)}</h2><p class="profile-email">${escapeHtml(email)}</p><span class="profile-role-pill">Tower Representative</span></div></div><span class="verified-session">✓ Verified session</span></section><section class="profile-details-card"><div class="profile-details-heading"><div><p class="section-eyebrow">PROFILE DETAILS</p><h2>Your Urbanity account</h2></div><span class="association-note">Tower association managed by Community Admin</span></div><div class="profile-detail-grid"><div><span>FULL NAME</span><b>${escapeHtml(name)}</b></div><div><span>EMAIL ADDRESS</span><b>${escapeHtml(email || 'Not provided')}</b></div><div><span>MOBILE NUMBER</span><b>${escapeHtml(phone)}</b></div><div><span>COMMUNITY</span><b>${escapeHtml(community?.name || 'Not available')}</b></div><div><span>ASSIGNED TOWER</span><b>${escapeHtml(tower?.name || 'Not available')}</b></div><div><span>TOWER CODE</span><b>${escapeHtml(tower?.code || 'Not available')}</b></div></div></section><section class="profile-performance-card"><div><p class="section-eyebrow">TOWER WORKSPACE</p><h2>Current activity</h2></div><div class="profile-activity-metrics"><div><b>${state.complaints.length}</b><span>Total handled</span></div><div><b>${active}</b><span>Active work</span></div><div><b>${resolved}</b><span>Resolved</span></div></div></section></div>`;
  }

  function observedResidents() {
    const residents = new Map();
    state.complaints.forEach((complaint) => {
      const context = complaintContext(complaint);
      if (!complaint.residentId || residents.has(complaint.residentId)) return;
      residents.set(complaint.residentId, { id: complaint.residentId, name: residentLabel(context), email: context.user?.email || 'Email unavailable', apartment: apartmentLabel(context), floor: context.floor?.label || context.floor?.name || 'Floor unavailable' });
    });
    return [...residents.values()];
  }

  function renderTowerOverview() {
    const target = document.getElementById('towerContent');
    if (!target) return;
    const { tower, community, user } = state.hierarchy || {};
    const contexts = [...state.residentContexts.values()];
    const observedFloors = [...new Set(contexts.map((context) => context.floor?.label || context.floor?.name).filter(Boolean))];
    const observedApartments = [...new Set(contexts.map((context) => apartmentLabel(context)).filter((value) => value !== 'Apartment unavailable'))];
    target.innerHTML = `<div class="page-header"><div><p class="section-eyebrow">TOWER INFORMATION</p><h1 class="page-title">${escapeHtml(tower?.name || 'Tower Overview')}</h1><p class="page-description">Your authenticated tower association and data observed within authorized complaints.</p></div></div><section class="tower-hero"><div><p class="section-eyebrow">ASSIGNED TOWER</p><h2>${escapeHtml(tower?.name || 'Tower unavailable')}</h2><p>${escapeHtml(community?.name || 'Community unavailable')}</p></div><span class="tower-code">${escapeHtml(tower?.code || '—')}</span></section><div class="tower-info-grid"><section class="card"><div class="card-header"><h3 class="card-title">Tower details</h3></div><div class="card-content"><dl class="info-list"><dt>Tower name</dt><dd>${escapeHtml(tower?.name || 'Not available')}</dd><dt>Tower code</dt><dd>${escapeHtml(tower?.code || 'Not available')}</dd><dt>Community</dt><dd>${escapeHtml(community?.name || 'Not available')}</dd><dt>Representative</dt><dd>${escapeHtml(user?.name || 'Not available')}</dd></dl></div></section><section class="card"><div class="card-header"><h3 class="card-title">Observed complaint context</h3></div><div class="card-content"><div class="observed-metrics"><div><b>${observedFloors.length}</b><span>Observed floors</span></div><div><b>${observedApartments.length}</b><span>Observed apartments</span></div><div><b>${observedResidents().length}</b><span>Residents linked to complaints</span></div></div><p class="data-scope-note">Counts are based on authorized complaint records. Full floor, apartment, and occupancy listings require a Tower Representative hierarchy endpoint.</p></div></section></div>`;
  }

  function populateResidentFloors() {
    const select = document.getElementById('residentFloorFilter');
    if (!select) return;
    const selected = select.value;
    const floors = [...new Set(observedResidents().map((resident) => resident.floor).filter((floor) => floor !== 'Floor unavailable'))];
    select.innerHTML = `<option value="">All observed floors</option>${floors.map((floor) => `<option value="${escapeHtml(floor)}">${escapeHtml(floor)}</option>`).join('')}`;
    select.value = selected;
  }

  function renderResidents() {
    const target = document.getElementById('residentsContent');
    if (!target) return;
    populateResidentFloors();
    const floor = document.getElementById('residentFloorFilter')?.value || '';
    const residents = observedResidents().filter((resident) => !floor || resident.floor === floor);
    target.innerHTML = residents.length ? `<div class="card"><div class="card-header"><h3 class="card-title">Residents linked to tower complaints</h3></div><div class="table-container"><table class="data-table"><thead><tr><th>Resident</th><th>Apartment</th><th>Floor</th><th>Complaint activity</th></tr></thead><tbody>${residents.map((resident) => { const count = state.complaints.filter((complaint) => complaint.residentId === resident.id).length; return `<tr><td><b>${escapeHtml(resident.name)}</b><br><small class="text-muted">${escapeHtml(resident.email)}</small></td><td>${escapeHtml(resident.apartment)}</td><td>${escapeHtml(resident.floor)}</td><td>${count} complaint${count === 1 ? '' : 's'}</td></tr>`; }).join('')}</tbody></table></div></div>` : '<div class="card"><div class="card-content empty-state">No residents are available from your authorized complaint records.</div></div>';
  }

  function countBy(items, getKey) { return items.reduce((counts, item) => { const key = getKey(item) || 'UNKNOWN'; counts[key] = (counts[key] || 0) + 1; return counts; }, {}); }
  function rowsForCounts(counts) { const entries = Object.entries(counts); return entries.length ? entries.map(([key, value]) => `<tr><td>${escapeHtml(labelEnum(key))}</td><td>${value}</td></tr>`).join('') : '<tr><td colspan="2">No complaint data available.</td></tr>'; }
  function averageResolutionHours() {
    const values = state.complaints.map((complaint) => { const resolved = (complaint.statusHistory || []).find((entry) => entry.status === 'RESOLVED'); return resolved && complaint.createdAt ? (new Date(resolved.changedAt).getTime() - new Date(complaint.createdAt).getTime()) / 3600000 : null; }).filter((value) => Number.isFinite(value) && value >= 0);
    return values.length ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)} hours` : 'Not available';
  }

  function distributionBars(counts) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '<p class="report-empty">No complaint data is available yet.</p>';
    const max = Math.max(...entries.map(([, value]) => value));
    return `<div class="distribution-bars">${entries.map(([key, value]) => `<div class="distribution-row"><div class="distribution-label"><span>${escapeHtml(labelEnum(key))}</span><b>${value}</b></div><div class="distribution-track"><span style="width:${max ? Math.round((value / max) * 100) : 0}%"></span></div></div>`).join('')}</div>`;
  }

  function complaintTrend() {
    const counts = countBy(state.complaints, (complaint) => String(complaint.createdAt || '').slice(0, 7));
    const entries = Object.entries(counts).filter(([month]) => /^\d{4}-\d{2}$/.test(month)).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    if (!entries.length) return '<p class="report-empty">No complaint activity is available yet.</p>';
    const max = Math.max(...entries.map(([, value]) => value));
    return `<div class="trend-chart">${entries.map(([month, value]) => `<div class="trend-column"><div class="trend-value">${value}</div><div class="trend-bar-wrap"><span style="height:${max ? Math.max(10, Math.round((value / max) * 100)) : 0}%"></span></div><span class="trend-label">${escapeHtml(new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }))}</span></div>`).join('')}</div>`;
  }

  function renderReports() {
    const target = document.getElementById('reportsContent');
    if (!target) return;
    const total = state.complaints.length;
    const resolved = state.complaints.filter((complaint) => ['RESOLVED', 'REVIEWED', 'CLOSED'].includes(complaint.status)).length;
    const workerRows = state.workers.map((worker) => `<tr><td>${escapeHtml(workerReference(worker))}</td><td>${escapeHtml(labelEnum(worker.specialization))}</td><td>${activeWorkload(worker.id)}</td><td>${worker.completedWorkCount || 0}</td><td>${Number(worker.rating || 0).toFixed(1)} / 5</td></tr>`).join('') || '<tr><td colspan="5">No Worker Profiles available.</td></tr>';
    const statusCounts = countBy(state.complaints, (complaint) => complaint.status);
    const workTypeCounts = countBy(state.complaints, (complaint) => complaint.requiredWorkType);
    const floorCounts = countBy(state.complaints, (complaint) => complaintContext(complaint).floor?.label || complaintContext(complaint).floor?.name || 'Unavailable');
    target.innerHTML = `<div class="reports-page"><section class="reports-hero"><div><p class="section-eyebrow">TOWER ANALYTICS</p><h1>Reports</h1><p>Live insights from complaints and Worker Profiles in your authorized tower scope.</p></div><span>Updated ${formatDateTime(new Date().toISOString())}</span></section><div class="report-summary"><div><b>${total}</b><span>Total complaints</span></div><div><b>${total - resolved}</b><span>Pending complaints</span></div><div><b>${resolved}</b><span>Resolved complaints</span></div><div><b>${total ? Math.round((resolved / total) * 100) : 0}%</b><span>Resolution rate</span></div><div><b>${averageResolutionHours()}</b><span>Average resolution time</span></div></div><div class="reports-visual-grid"><section class="card report-chart-card"><div class="card-header"><div><p class="card-eyebrow">COMPLAINT ACTIVITY</p><h3 class="card-title">Complaint trend</h3></div></div><div class="card-content">${complaintTrend()}</div></section><section class="card report-chart-card"><div class="card-header"><div><p class="card-eyebrow">CURRENT DISTRIBUTION</p><h3 class="card-title">Complaints by status</h3></div></div><div class="card-content">${distributionBars(statusCounts)}</div></section><section class="card report-chart-card"><div class="card-header"><div><p class="card-eyebrow">SERVICE DEMAND</p><h3 class="card-title">Required work type</h3></div></div><div class="card-content">${distributionBars(workTypeCounts)}</div></section><section class="card report-chart-card"><div class="card-header"><div><p class="card-eyebrow">TOWER ACTIVITY</p><h3 class="card-title">Complaints by observed floor</h3></div></div><div class="card-content">${distributionBars(floorCounts)}</div></section></div><section class="card worker-performance-report"><div class="card-header"><div><p class="card-eyebrow">ASSIGNMENT CAPACITY</p><h3 class="card-title">Worker Profile performance</h3></div><span class="report-scope-label">Community-scoped profiles</span></div><div class="table-container"><table class="data-table"><thead><tr><th>Worker Profile</th><th>Specialization</th><th>Active tower tasks</th><th>Completed work</th><th>Rating</th></tr></thead><tbody>${workerRows}</tbody></table></div></section><p class="report-data-note">Resolution time is calculated from complaint creation to the recorded <b>Resolved</b> status. Floor results include only floors observed in authorized complaint records.</p></div>`;
  }

  async function openComplaintDetail(id) {
    try {
      const [complaintRes, attachmentsRes] = await Promise.all([api(`/complaints/${id}`), api(`/complaints/${id}/attachments`)]);
      const complaint = { ...complaintRes.data, attachments: attachmentsRes.data || [] };
      state.activeComplaint = complaint;

      let reviewHtml = '';
      try {
        const reviewRes = await api(`/complaints/${id}/review`);
        if (reviewRes.data) reviewHtml = `<div class="modal-section"><h4>Review</h4><p>Rating: ${reviewRes.data.rating}/5 ${reviewRes.data.feedback ? `— ${escapeHtml(reviewRes.data.feedback)}` : ''}</p></div>`;
      } catch { /* no review yet */ }

      const assignedWorker = complaint.assignedWorkerId
        ? state.workers.find((w) => w.id === complaint.assignedWorkerId) || { name: 'Maintenance Worker' }
        : null;
      const context = complaintContext(complaint);
      const history = complaint.statusHistory || [];
      const timeline = history.map((entry, index) => `<li class="timeline-item ${index === history.length - 1 ? 'current' : ''}"><span class="timeline-dot"></span><div><b>${escapeHtml(labelEnum(entry.status))}</b><p>${formatDateTime(entry.changedAt)} · ${escapeHtml(labelEnum(entry.changedByRole))}</p></div></li>`).join('') || '<li class="timeline-item"><div><p>No status history is available.</p></div></li>';

      document.getElementById('complaintModalTitle').textContent = complaint.title || 'Complaint details';
      const attachments = complaint.attachments.length ? `<div class="attachment-list">${complaint.attachments.map((attachment) => `<div class="attachment-item"><span>${escapeHtml(attachment.originalName || 'Attachment')}</span>${String(attachment.mimeType || '').startsWith('image/') ? `<button type="button" class="btn btn-outline btn-sm" onclick="previewAttachment('${complaint.id}', '${attachment.id}')">View image</button>` : '<span class="text-muted">File attachment</span>'}</div>`).join('')}</div>` : '<p>No attachments.</p>';
      document.getElementById('complaintModalBody').innerHTML = `<div class="modal-section"><div class="modal-grid"><div><span class="modal-label">Status</span><span>${statusBadge(complaint.status)}</span></div><div><span class="modal-label">Required work</span><span>${escapeHtml(labelEnum(complaint.requiredWorkType))}</span></div><div><span class="modal-label">Created</span><span>${formatDate(complaint.createdAt)}</span></div><div><span class="modal-label">Updated</span><span>${formatDate(complaint.updatedAt)}</span></div></div></div><div class="modal-section"><h4>Resident & apartment</h4><p><b>${escapeHtml(residentLabel(context))}</b><br>${escapeHtml(apartmentLabel(context))}${context.floor?.name ? ` · ${escapeHtml(context.floor.name)}` : ''}</p></div><div class="modal-section"><h4>Description</h4><p>${escapeHtml(complaint.description || 'No description provided.')}</p></div><div class="modal-section"><h4>Scope</h4><p>${escapeHtml(labelEnum(complaint.type))} complaint within ${escapeHtml(state.hierarchy?.tower?.name || 'your tower')}${assignedWorker ? `<br>Assigned Worker Profile: ${escapeHtml(workerReference(assignedWorker))}` : ''}</p></div><div class="modal-section"><h4>Status timeline</h4><ol class="status-timeline">${timeline}</ol></div>${reviewHtml}<div class="modal-section"><h4>Attachments</h4>${attachments}</div>`;

      document.getElementById('complaintModalBody').insertAdjacentHTML('afterbegin', `<div class="modal-section lifecycle-guidance"><h4>Next step</h4><p>${escapeHtml(lifecycleGuidance(complaint.status))}</p></div>`);
      const footer = document.getElementById('complaintModalFooter');
      let actions = '<button type="button" class="btn btn-outline" onclick="closeComplaintModal()">Close</button>';

      if (complaint.status === 'SUBMITTED') {
        actions = `<button type="button" class="btn btn-outline" onclick="closeComplaintModal()">Close</button><button type="button" class="btn btn-primary" onclick="transitionComplaint('${id}', 'UNDER_REVIEW')">Mark Under Review</button>`;
      } else if (complaint.status === 'UNDER_REVIEW') {
        actions = `<button type="button" class="btn btn-outline" onclick="closeComplaintModal()">Close</button><button type="button" class="btn btn-primary" onclick="openWorkerSelection('${id}')">Assign Worker</button>`;
      } else if (complaint.status === 'REVIEWED') {
        actions = `<button type="button" class="btn btn-outline" onclick="closeComplaintModal()">Close</button><button type="button" class="btn btn-primary" onclick="transitionComplaint('${id}', 'CLOSED')">Close Complaint</button>`;
      }

      footer.innerHTML = actions;
      document.getElementById('complaintModal').classList.add('active');
    } catch (err) {
      toast('Unable to load complaint details.', 'error');
      console.error('Complaint detail error:', err);
    }
  }

  function closeComplaintModal() {
    document.getElementById('complaintModal').classList.remove('active');
    state.activeComplaint = null;
  }

  async function transitionComplaint(id, targetStatus) {
    try {
      await api(`/complaints/${id}/status`, { method: 'PATCH', body: { status: targetStatus } });
      closeComplaintModal();
      toast(`Complaint ${targetStatus === 'UNDER_REVIEW' ? 'moved to Under Review' : 'closed'}.`, 'success');
      await Promise.all([loadComplaints(), loadDashboard()]);
      if (state.currentPage === 'complaints') renderComplaints();
    } catch (err) {
      toast(err.message || 'Unable to update complaint status.', 'error');
    }
  }

  async function openWorkerSelection(complaintId) {
    try {
      closeComplaintModal();
      const response = await api(`/complaints/${complaintId}/eligible-workers`);
      const workers = response.data || [];
      state.activeComplaint = state.complaints.find((c) => c.id === complaintId) || { id: complaintId };

      const body = document.getElementById('workerModalBody');
      const footer = document.getElementById('workerModalFooter');

      if (!workers.length) {
        body.innerHTML = '<p class="empty-state">No eligible workers available at this time.</p>';
        footer.innerHTML = '<button type="button" class="btn btn-outline" onclick="closeWorkerModal()">Close</button>';
      } else {
        const recommended = [...workers].sort((a, b) => activeWorkload(a.id) - activeWorkload(b.id) || Number(b.rating || 0) - Number(a.rating || 0))[0];
        body.innerHTML = `<p class="assignment-guidance">Recommended Worker Profile matches the required specialization, is available, and has the lowest visible tower workload.</p><div class="worker-list">${workers.map((w) => `<button type="button" class="worker-item ${w.id === recommended?.id ? 'recommended' : ''}" data-worker-id="${w.id}" onclick="selectWorker(this, '${w.id}')"><div class="worker-item-header"><b>${escapeHtml(workerReference(w))}${w.id === recommended?.id ? ' <span class="recommendation-tag">Recommended</span>' : ''}</b><span class="status-badge status-available">Available</span></div><small>${escapeHtml(labelEnum(w.specialization))} · Rating: ${Number(w.rating || 0).toFixed(1)} / 5 · Active tower tasks: ${activeWorkload(w.id)}</small></button>`).join('')}</div>`;
        footer.innerHTML = '<button type="button" class="btn btn-outline" onclick="closeWorkerModal()">Cancel</button><button type="button" class="btn btn-primary" id="confirmAssignBtn" disabled onclick="confirmWorkerAssignment()">Assign Worker</button>';
      }

      document.getElementById('workerModal').classList.add('active');
    } catch (err) {
      toast('Unable to load eligible workers.', 'error');
      console.error('Eligible workers error:', err);
    }
  }

  function selectWorker(el, workerId) {
    document.querySelectorAll('.worker-item').forEach((item) => item.classList.remove('selected'));
    el.classList.add('selected');
    state.selectedWorker = workerId;
    const btn = document.getElementById('confirmAssignBtn');
    if (btn) btn.disabled = false;
  }

  async function confirmWorkerAssignment() {
    if (!state.activeComplaint || !state.selectedWorker) return;
    const btn = document.getElementById('confirmAssignBtn');
    if (btn) btn.disabled = true;

    try {
      await api(`/complaints/${state.activeComplaint.id}/assign`, { method: 'POST', body: { workerId: state.selectedWorker } });
      closeWorkerModal();
      toast('Worker assigned successfully.', 'success');
      await Promise.all([loadComplaints(), loadWorkers(), loadDashboard()]);
      if (state.currentPage === 'complaints') renderComplaints();
    } catch (err) {
      toast(err.message || 'Unable to assign worker.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function closeWorkerModal() {
    document.getElementById('workerModal').classList.remove('active');
    state.selectedWorker = null;
  }

  async function previewAttachment(complaintId, attachmentId) {
    try {
      const blob = await api(`/complaints/${complaintId}/attachments/${attachmentId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const body = document.getElementById('attachmentModalBody');
      const filename = state.activeComplaint?.attachments?.find((attachment) => attachment.id === attachmentId)?.originalName || 'Attachment';
      document.getElementById('attachmentModalTitle').textContent = filename || 'Attachment';
      body.innerHTML = `<img class="attachment-preview" src="${url}" alt="${escapeHtml(filename || 'Complaint attachment')}">`;
      body.dataset.objectUrl = url;
      document.getElementById('attachmentModal').classList.add('active');
    } catch (err) { toast(err.message || 'Unable to preview this attachment.', 'error'); }
  }

  function closeAttachmentModal() {
    const body = document.getElementById('attachmentModalBody');
    if (body?.dataset.objectUrl) URL.revokeObjectURL(body.dataset.objectUrl);
    if (body) { body.innerHTML = ''; delete body.dataset.objectUrl; }
    document.getElementById('attachmentModal').classList.remove('active');
  }

  function showLoading(loadingId, contentId, show) {
    const loading = document.getElementById(loadingId);
    const content = document.getElementById(contentId);
    if (loading) loading.classList.toggle('hidden', !show);
    if (content) content.classList.toggle('hidden', show);
  }

  function navigateTo(page) {
    state.currentPage = page;

    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    if (page === 'dashboard') loadDashboard();
    else if (page === 'complaints') loadComplaints();
    else if (page === 'workers') { loadWorkers(); startWorkforceRefresh(); }
    else if (['tower', 'residents', 'reports'].includes(page)) refreshTowerInsights();
    else if (page === 'profile') { if (state.hierarchy) renderProfile(); else loadHierarchy().then(renderProfile); }
    if (page !== 'workers') stopWorkforceRefresh();
  }

  function toggleDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) dropdown.classList.toggle('active');
  }

  function closeDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) dropdown.classList.remove('active');
  }

  function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    const trigger = document.getElementById('notificationBtn');
    if (!dropdown) return;
    const willOpen = !dropdown.classList.contains('active');
    closeDropdown();
    dropdown.classList.toggle('active', willOpen);
    trigger?.setAttribute('aria-expanded', String(willOpen));
  }

  function closeNotificationDropdown() {
    document.getElementById('notificationDropdown')?.classList.remove('active');
    document.getElementById('notificationBtn')?.setAttribute('aria-expanded', 'false');
  }

  function signOut() {
    window.UrbanityApi.logout();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const token = window.UrbanityApi?.getAccessToken();
    if (!token) { signOut(); return; }

    document.querySelectorAll('.nav-item[data-page]').forEach((btn) => btn.addEventListener('click', (e) => { e.preventDefault(); navigateTo(btn.dataset.page); }));
    document.getElementById('signOutBtn')?.addEventListener('click', signOut);
    document.getElementById('dropdownSignOut')?.addEventListener('click', signOut);
    document.getElementById('userProfileBtn')?.addEventListener('click', toggleDropdown);
    document.getElementById('notificationBtn')?.addEventListener('click', toggleNotificationDropdown);
    document.getElementById('openComplaintsBtn')?.addEventListener('click', () => navigateTo('complaints'));
    document.getElementById('viewPendingComplaints')?.addEventListener('click', () => {
      closeNotificationDropdown();
      const statusFilter = document.getElementById('complaintStatusFilter');
      if (statusFilter) statusFilter.value = 'SUBMITTED';
      navigateTo('complaints');
    });
    document.getElementById('viewProfileBtn')?.addEventListener('click', () => { closeDropdown(); navigateTo('profile'); });
    document.getElementById('complaintModalClose')?.addEventListener('click', closeComplaintModal);
    document.getElementById('workerModalClose')?.addEventListener('click', closeWorkerModal);
    document.getElementById('attachmentModalClose')?.addEventListener('click', closeAttachmentModal);
    document.getElementById('complaintStatusFilter')?.addEventListener('change', renderComplaints);
    document.getElementById('complaintTypeFilter')?.addEventListener('change', renderComplaints);
    document.getElementById('complaintDateFilter')?.addEventListener('change', renderComplaints);
    document.getElementById('complaintSearch')?.addEventListener('input', renderComplaints);
    document.getElementById('workerSearch')?.addEventListener('input', renderWorkers);
    document.getElementById('workerSpecializationFilter')?.addEventListener('change', renderWorkers);
    document.getElementById('workerAvailabilityFilter')?.addEventListener('change', renderWorkers);
    document.getElementById('refreshWorkersBtn')?.addEventListener('click', () => loadWorkers());
    document.getElementById('residentFloorFilter')?.addEventListener('change', renderResidents);

    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('profileDropdown');
      const trigger = document.getElementById('userProfileBtn');
      if (dropdown && trigger && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        dropdown.classList.remove('active');
      }
      const notifications = document.getElementById('notificationDropdown');
      const notificationTrigger = document.getElementById('notificationBtn');
      if (notifications && notificationTrigger && !notifications.contains(e.target) && !notificationTrigger.contains(e.target)) closeNotificationDropdown();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.currentPage === 'workers') loadWorkers();
    });

    window.addEventListener('beforeunload', stopWorkforceRefresh);

    document.addEventListener('submit', (e) => e.preventDefault(), true);

    try {
      await loadHierarchy();
      navigateTo('dashboard');
    } catch (err) {
      toast('Unable to initialize portal.', 'error');
    }
  });

  window.openComplaintDetail = openComplaintDetail;
  window.closeComplaintModal = closeComplaintModal;
  window.transitionComplaint = transitionComplaint;
  window.openWorkerSelection = openWorkerSelection;
  window.selectWorker = selectWorker;
  window.confirmWorkerAssignment = confirmWorkerAssignment;
  window.closeWorkerModal = closeWorkerModal;
  window.previewAttachment = previewAttachment;
})();
