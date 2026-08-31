const towerState = { page: "dashboard", hierarchy: null, complaints: [], active: null };
const label = (v) => String(v || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const date = (v) => v ? new Date(v).toLocaleString() : "—";
const api = (path, options) => window.UrbanityApi.apiRequest(path, options);
const message = (text) => window.alert(text);

async function loadTowerData() { const [h, c] = await Promise.all([api("/users/me/hierarchy"), api("/complaints")]); towerState.hierarchy = h.data; towerState.complaints = c.data || []; }
function row(c) { return `<tr><td><button class="btn-link complaint" data-id="${c.id}">${c.title}</button><small>${label(c.type)} · ${label(c.requiredWorkType)}</small></td><td>${label(c.status)}</td><td>${date(c.updatedAt)}</td></tr>`; }
function table(items) { return items.length ? `<table class="issues-table"><thead><tr><th>Complaint</th><th>Status</th><th>Updated</th></tr></thead><tbody>${items.map(row).join("")}</tbody></table>` : "<p>No tower complaints found.</p>"; }
function dashboard() { const c = towerState.complaints; const tower = towerState.hierarchy?.tower; return `<div class="page-header"><h1>Tower Dashboard</h1><p>${tower?.name || "Tower"} · ${towerState.hierarchy?.community?.name || ""}</p></div><div class="stats-grid"><div class="stat-card"><b>${c.length}</b><span>Total complaints</span></div><div class="stat-card"><b>${c.filter(x=>x.status==="SUBMITTED").length}</b><span>Submitted</span></div><div class="stat-card"><b>${c.filter(x=>["ASSIGNED","IN_PROGRESS"].includes(x.status)).length}</b><span>Active work</span></div></div><section class="content-card"><h2>Recent complaints</h2>${table(c.slice(0,8))}</section>`; }
function complaintList() { return `<div class="page-header"><h1>Tower Complaints</h1><p>Complaints are scoped by your authenticated tower representative role.</p></div><section class="content-card">${table(towerState.complaints)}</section>`; }
function profile() { const {user,tower,community}=towerState.hierarchy||{}; return `<section class="content-card"><h1>Tower Representative Profile</h1><p><b>${user?.name||"—"}</b><br>${user?.email||""}</p><p><b>Tower:</b> ${tower?.name||"—"}<br><b>Community:</b> ${community?.name||"—"}</p></section>`; }
function render(page=towerState.page) { towerState.page=page; const content={dashboard, "validate-assign":complaintList, "verify-resolution":complaintList, "reopened-issues":complaintList, "field-workers":complaintList, profile}[page] || dashboard; document.getElementById("pageContent").innerHTML=content(); document.querySelectorAll(".nav-link").forEach(a=>a.classList.toggle("active",a.dataset.page===page)); document.querySelectorAll(".complaint").forEach(b=>b.onclick=()=>openComplaint(b.dataset.id)); }
async function openComplaint(id) {
  try {
    const [complaintResponse, attachmentResponse] = await Promise.all([api(`/complaints/${id}`), api(`/complaints/${id}/attachments`)]);
    const complaint = { ...complaintResponse.data, attachments: attachmentResponse.data || [] };
    let review = null;
    try { review = (await api(`/complaints/${id}/review`)).data; } catch (error) { if (error.status !== 404) throw error; }
    document.getElementById("pageContent").innerHTML = `<section class="content-card"><button id="back">← Back</button><h1>${complaint.title}</h1><p>${complaint.description}</p><p><b>Location:</b> ${label(complaint.type)} complaint · ${label(complaint.status)} · ${label(complaint.requiredWorkType)}</p><p><b>Attachments:</b> ${complaint.attachments.map((attachment) => attachment.originalName).join(", ") || "None"}</p><p><b>Review:</b> ${review ? `${review.rating}/5 ${review.feedback || ""}` : "Not available"}</p><div id="actions"></div></section>`;
    document.getElementById("back").onclick = () => render("validate-assign");
    const actions = document.getElementById("actions");
    if (complaint.status === "SUBMITTED") actions.innerHTML = '<button id="review">Review Complaint</button>';
    if (complaint.status === "UNDER_REVIEW") {
      const workers = (await api(`/complaints/${id}/eligible-workers`)).data || [];
      actions.innerHTML = `<h3>Eligible Maintenance Workers</h3>${workers.length ? workers.map((worker) => `<button class="worker" data-id="${worker.id}">${worker.specialization} · ${worker.status} · ${worker.rating}/5</button>`).join("") : "<p>No eligible maintenance workers available.</p>"}`;
    }
    if (complaint.status === "REVIEWED") actions.innerHTML = '<button id="close">Close Complaint</button>';
    document.getElementById("review")?.addEventListener("click", () => transition(id, "UNDER_REVIEW"));
    document.getElementById("close")?.addEventListener("click", () => transition(id, "CLOSED"));
    document.querySelectorAll(".worker").forEach((button) => { button.onclick = () => assign(id, button.dataset.id); });
  } catch (error) { message(error.message || "Unable to load complaint."); }
}
async function transition(id,status){try{await api(`/complaints/${id}/status`,{method:"PATCH",body:{status}});await loadTowerData();openComplaint(id);}catch(e){message(e.message)}}
async function assign(id,workerId){try{await api(`/complaints/${id}/assign`,{method:"POST",body:{workerId}});await loadTowerData();openComplaint(id);message("Maintenance worker assigned.");}catch(e){message(e.message)}}
document.addEventListener("DOMContentLoaded",async()=>{if(!window.UrbanityApi?.getAccessToken()) return window.UrbanityApi?.logout(); document.querySelectorAll(".nav-link").forEach(a=>a.onclick=e=>{e.preventDefault();render(a.dataset.page)}); document.querySelector(".sign-out-btn")?.addEventListener("click",()=>window.UrbanityApi.logout()); try{await loadTowerData();render();}catch(e){message(e.message||"Unable to load portal.")}});
