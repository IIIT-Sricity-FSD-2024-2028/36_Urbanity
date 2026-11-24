import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { AxiosError } from "axios";
import { createServer } from "vite";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

let vite, client, api, stores, feature, originalAdapter;
const testStores = [];
const admin = { id: "admin", email: "admin@example.test", role: "COMMUNITY_ADMIN" };
const ok = (data) => ({ status: 200, data: { success: true, data } });
function fail(config, status, message) {
  throw new AxiosError("Request failed", undefined, config, undefined, {
    status, data: { error: { message }, privateDiagnostic: "must-not-enter-redux" },
  });
}

before(async () => {
  vite = await createServer({ configFile: false, logLevel: "error", server: { middlewareMode: true, watch: null, ws: false } });
  client = await vite.ssrLoadModule("/src/api/client.js");
  stores = await vite.ssrLoadModule("/src/app/store.js");
  feature = await vite.ssrLoadModule("/src/features/community-admin/services/communityDirectoryApi.js");
  api = feature.communityDirectoryApi;
  originalAdapter = client.api.defaults.adapter;
  const storage = new Map();
  globalThis.window = { sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } };
});
beforeEach(() => client.saveSession("test-session", admin));
afterEach(() => {
  for (const store of testStores.splice(0)) store.dispatch(api.util.resetApiState());
  client.api.defaults.adapter = originalAdapter;
  client.clearSession();
});
after(async () => { delete globalThis.window; await vite?.close(); });

function freshStore(actions = []) {
  const store = stores.createAppStore([() => (next) => (action) => {
    actions.push(JSON.stringify(action));
    return next(action);
  }]);
  testStores.push(store);
  return store;
}
function query(store, endpoint, args = client.getSessionRevision()) {
  return store.dispatch(api.endpoints[endpoint].initiate(args));
}
const write = (store, endpoint, args) => feature.mutateCommunityDirectory(store.dispatch, endpoint, args);
async function settle(store) {
  // RTK Query can defer invalidation until an earlier query finishes.
  let pending;
  do {
    pending = store.dispatch(api.util.getRunningQueriesThunk());
    await Promise.all(pending);
  } while (pending.length);
}
const names = {
  communities: "listCommunityAdminCommunities", towers: "listCommunityAdminTowers",
  floors: "listCommunityAdminFloors", apartments: "listCommunityAdminApartments",
  users: "listCommunityAdminUsers", workers: "listCommunityAdminWorkers",
};
const paths = { communities: "/communities", towers: "/towers", floors: "/floors", apartments: "/apartments", users: "/users", workers: "/workforce/workers" };
function model() {
  const data = {
    communities: [{ id: "c", name: "Community" }],
    towers: [{ id: "t", communityId: "c", name: "Tower", code: "T" }],
    floors: [{ id: "f", towerId: "t", label: "First", floorNumber: 1 }],
    apartments: [{ id: "a", floorId: "f", apartmentNumber: "101", label: "Home", ownerUserId: null }],
    users: [{ ...admin }, { id: "resident", role: "RESIDENT", name: "Resident", apartmentId: "a" }],
    workers: [],
  };
  const reads = {}, requests = [], histories = { a: [], other: [] };
  client.api.defaults.adapter = async (config) => {
    requests.push({ method: config.method, url: config.url, body: config.data && JSON.parse(config.data) });
    if (config.method === "get") reads[config.url] = (reads[config.url] || 0) + 1;
    const history = config.url.match(/^\/apartments\/(.+)\/ownership-history$/);
    if (history) return ok(structuredClone(histories[history[1]] || []));
    const transfer = config.url.match(/^\/apartments\/(.+)\/ownership-transfer$/);
    if (transfer) {
      const changes = JSON.parse(config.data);
      const apartment = data.apartments.find(({ id }) => id === transfer[1]);
      if (changes.reason === "fail") fail(config, 409, "Recorded owner changed");
      apartment.ownerUserId = changes.newOwnerUserId;
      (histories[transfer[1]] ||= []).push({ id: "history", ...changes });
      return ok(apartment);
    }
    const association = config.url.match(/^\/users\/(.+)\/(resident-apartment|representative-tower)$/);
    if (association) {
      const user = data.users.find(({ id }) => id === association[1]);
      Object.assign(user, JSON.parse(config.data));
      return ok({ ...user, passwordHash: "raw-secret-hash" });
    }
    const resource = Object.keys(paths).find((key) => config.url === paths[key] || config.url.startsWith(paths[key] + "/"));
    assert.ok(resource, `Unexpected route ${config.url}`);
    if (config.method === "get") return ok(structuredClone(data[resource]));
    assert.ok(config.signal || resource === "users" || resource === "workers");
    const id = config.url.slice(paths[resource].length + 1);
    if (config.method === "delete") {
      if (resource === "workers") data.workers.find((item) => item.id === id).status = "INACTIVE";
      else data[resource] = data[resource].filter((item) => item.id !== id);
      return ok();
    }
    const changes = JSON.parse(config.data);
    if (config.method === "post") {
      const { password: _password, ...safe } = changes;
      const item = { id: `new-${resource}`, ...safe };
      data[resource].push(item);
      return ok(item);
    }
    const item = data[resource].find((item) => item.id === id);
    const { password: _password, ...safe } = changes;
    Object.assign(item, safe);
    return ok(item);
  };
  return { data, reads, requests, histories };
}
async function subscribeAll(store) {
  await Promise.all(Object.values(names).map((name) => query(store, name).unwrap()));
}
function selected(store, resource) {
  return api.endpoints[names[resource]].select(client.getSessionRevision())(store.getState());
}

test("reuses all directory caches for repeated subscribers and keeps history keys apartment-specific", async () => {
  const store = freshStore(), { reads } = model();
  assert.equal(api, (await vite.ssrLoadModule("/src/api/urbanityApi.js")).urbanityApi);
  await subscribeAll(store);
  await subscribeAll(store);
  for (const path of Object.values(paths)) assert.equal(reads[path], 1);
  const args = { id: "a", sessionRevision: client.getSessionRevision() };
  await Promise.all([query(store, "getCommunityAdminOwnershipHistory", args).unwrap(), query(store, "getCommunityAdminOwnershipHistory", args).unwrap()]);
  await query(store, "getCommunityAdminOwnershipHistory", { ...args, id: "other" }).unwrap();
  assert.equal(reads["/apartments/a/ownership-history"], 1);
  assert.equal(reads["/apartments/other/ownership-history"], 1);
});

test("deduplicates in-flight reads shared by Hierarchy, Users and Workforce subscriptions", async () => {
  const store = freshStore(), pending = Promise.withResolvers();
  let reads = 0;
  client.api.defaults.adapter = (config) => { reads++; assert.equal(config.url, "/users"); assert.ok(config.signal); return pending.promise; };
  const requests = Array.from({ length: 3 }, () => query(store, names.users));
  assert.equal(selected(store, "users").isLoading, true);
  pending.resolve(ok([admin]));
  assert.deepEqual(await Promise.all(requests.map((request) => request.unwrap())), [[admin], [admin], [admin]]);
  assert.equal(reads, 1);
});

for (const [resource, singular, payload, changes] of [
  ["towers", "Tower", { communityId: "c", name: "New", code: "N", description: "" }, { name: "Renamed" }],
  ["floors", "Floor", { towerId: "t", floorNumber: 2, label: "Second" }, { label: "Renamed" }],
  ["apartments", "Apartment", { floorId: "f", apartmentNumber: "102", label: "New", ownerUserId: null }, { label: "Renamed" }],
]) {
  test(`${singular} create, update and delete refresh subscribed lists without refetching unrelated directories`, async () => {
    const store = freshStore(), { reads, requests } = model();
    await subscribeAll(store);
    await write(store, `createCommunityAdmin${singular}`, payload);
    await settle(store);
    assert.equal(selected(store, resource).data.at(-1).id, `new-${resource}`);
    await write(store, `updateCommunityAdmin${singular}`, { id: `new-${resource}`, changes });
    await settle(store);
    assert.equal(selected(store, resource).data.at(-1)[Object.keys(changes)[0]], "Renamed");
    await write(store, `deleteCommunityAdmin${singular}`, `new-${resource}`);
    await settle(store);
    assert.equal(selected(store, resource).data.some(({ id }) => id === `new-${resource}`), false);
    assert.equal(reads[paths[resource]], 4);
    assert.equal(reads[paths.communities], 1);
    assert.equal(reads[paths.users], 1);
    assert.equal(reads[paths.workers], 1);
    if (resource === "floors") assert.equal(reads[paths.apartments], 3);
    assert.deepEqual(requests.find((request) => request.method === "post").body, payload);
  });
}

test("ownership transfer refreshes apartments and only the affected ownership history", async () => {
  const store = freshStore(), { reads } = model();
  await subscribeAll(store);
  for (const id of ["a", "other"]) await query(store, "getCommunityAdminOwnershipHistory", { id, sessionRevision: client.getSessionRevision() }).unwrap();
  const transfer = { expectedOwnerUserId: null, newOwnerUserId: "resident", reason: "Sale", effectiveDate: "2026-11-22" };
  await feature.saveCommunityApartment(store.dispatch, "a", { label: "Updated" }, transfer);
  await settle(store);
  assert.equal(selected(store, "apartments").data[0].ownerUserId, "resident");
  assert.equal(reads["/apartments/a/ownership-history"], 2);
  assert.equal(reads["/apartments/other/ownership-history"], 1);
  assert.equal(reads["/users"], 1);
});

test("failed transfer preserves the successful apartment edit and leaves unchanged history cached", async () => {
  const store = freshStore(), { reads } = model();
  await subscribeAll(store);
  await query(store, "getCommunityAdminOwnershipHistory", { id: "a", sessionRevision: client.getSessionRevision() }).unwrap();
  await assert.rejects(feature.saveCommunityApartment(store.dispatch, "a", { label: "Saved details" }, { reason: "fail" }), /Apartment details were saved, but ownership transfer failed/);
  await settle(store);
  assert.equal(selected(store, "apartments").data[0].label, "Saved details");
  assert.equal(selected(store, "apartments").data[0].ownerUserId, null);
  assert.equal(reads["/apartments/a/ownership-history"], 1);
});

test("user creation, password edits, self-profile refresh and associations never put credentials in actions or state", async () => {
  const actions = [], store = freshStore(actions), { data, reads } = model();
  await subscribeAll(store);
  await feature.createCommunityUser({ name: "Owner", email: "owner@example.test", password: "private-test-password", role: "RESIDENT", residentSituation: "OWNER_OCCUPANT", apartmentId: "a" }, "", store.dispatch);
  await settle(store);
  assert.equal(reads["/apartments"], 2);
  let refreshes = 0;
  await feature.saveCommunityUser({ user: admin, payload: { name: "Admin updated", password: "private-test-password" } }, store.dispatch, { currentUserId: admin.id, refreshUser: async () => { refreshes++; } });
  assert.equal(refreshes, 1);
  const resident = data.users.find(({ id }) => id === "resident");
  await feature.saveCommunityUser({ user: resident, payload: { name: "Renamed" }, apartmentId: "other" }, store.dispatch, { currentUserId: admin.id });
  await settle(store);
  assert.equal(selected(store, "users").data.find(({ id }) => id === "resident").apartmentId, "other");
  data.users.push({ id: "rep", role: "TOWER_REPRESENTATIVE", towerId: "t" });
  await write(store, "associateCommunityAdminRepresentative", { id: "rep", towerId: "t2" });
  await settle(store);
  assert.equal(selected(store, "users").data.find(({ id }) => id === "rep").towerId, "t2");
  await write(store, "deleteCommunityAdminUser", "new-users");
  await settle(store);
  assert.equal(selected(store, "users").data.some(({ id }) => id === "new-users"), false);
  const captured = actions.join("\n") + JSON.stringify(store.getState());
  for (const secret of ["private-test-password", "raw-secret-hash", "passwordHash", '"password"']) assert.equal(captured.includes(secret), false, secret);
});

test("self-profile refresh also follows password-free edits", async () => {
  const store = freshStore(); model(); let refreshed = 0;
  await feature.saveCommunityUser({ user: admin, payload: { name: "Updated" } }, store.dispatch, { currentUserId: admin.id, refreshUser: async () => { refreshed++; } });
  assert.equal(refreshed, 1);
});

test("failed user association reconciles a successful account edit", async () => {
  const store = freshStore(), { data } = model(), adapter = client.api.defaults.adapter;
  await subscribeAll(store);
  client.api.defaults.adapter = (config) => config.url.endsWith("resident-apartment") ? fail(config, 403, "Association denied") : adapter(config);
  await assert.rejects(feature.saveCommunityUser({ user: data.users[1], payload: { name: "Saved name" }, apartmentId: "other" }, store.dispatch, { currentUserId: admin.id }), /User details were saved/);
  await settle(store);
  assert.equal(selected(store, "users").data[1].name, "Saved name");
  assert.equal(selected(store, "users").data[1].apartmentId, "a");
});

test("worker profile create, edit and deactivate refresh workforce without refetching users", async () => {
  const store = freshStore(), { reads } = model(); await subscribeAll(store);
  await write(store, "createCommunityAdminWorker", { userId: "worker-user", specialization: "PLUMBING" }); await settle(store);
  await write(store, "updateCommunityAdminWorker", { id: "new-workers", changes: { specialization: "HVAC" } }); await settle(store);
  assert.equal(selected(store, "workers").data[0].specialization, "HVAC");
  await write(store, "deactivateCommunityAdminWorker", "new-workers"); await settle(store);
  assert.equal(selected(store, "workers").data[0].status, "INACTIVE");
  assert.equal(reads["/workforce/workers"], 4);
  assert.equal(reads["/users"], 1);
});

for (const outcome of ["success", "rollback", "confirmed", "unconfirmed", "rollback-failed"]) {
  test(`worker provisioning handles ${outcome} and keeps passwords outside Redux`, async () => {
    const actions = [], store = freshStore(actions), state = model(), adapter = client.api.defaults.adapter;
    await subscribeAll(store);
    let profileAttempted = false;
    client.api.defaults.adapter = async (config) => {
      if (config.method === "post" && config.url === "/workforce/workers") {
        profileAttempted = true;
        if (outcome === "confirmed") await adapter(config);
        if (outcome !== "success") fail(config, 400, "Profile rejected");
      }
      if (outcome === "unconfirmed" && profileAttempted && config.method === "get" && config.url === "/workforce/workers") fail(config, 503, "Confirmation unavailable");
      if (outcome === "rollback-failed" && config.method === "delete") fail(config, 403, "Rollback denied");
      return adapter(config);
    };
    const provisioning = feature.createCommunityUser({ name: "Worker", email: "worker@example.test", password: "private-test-password", role: "MAINTENANCE_WORKER" }, "PLUMBING", store.dispatch);
    if (["success", "confirmed"].includes(outcome)) await provisioning;
    else await assert.rejects(provisioning, outcome === "rollback" ? /incomplete worker account was removed/ : /profile could not be confirmed/);
    await settle(store);
    assert.equal(state.data.users.some(({ id }) => id === "new-users"), outcome !== "rollback");
    assert.equal(selected(store, "users").data.some(({ id }) => id === "new-users"), outcome !== "rollback");
    if (["success", "confirmed"].includes(outcome)) assert.equal(selected(store, "workers").data.length, 1);
    assert.equal((actions.join("\n") + JSON.stringify(store.getState())).includes("private-test-password"), false);
  });
}

for (const [status, message] of [[400, ["name is required", "code is required"]], [403, "Insufficient permissions"], [409, "Tower capacity exceeded"]]) {
  test(`preserves ${status} errors and does not invalidate successful caches on rejected writes`, async () => {
    const store = freshStore(), { reads } = model(), adapter = client.api.defaults.adapter;
    await subscribeAll(store);
    client.api.defaults.adapter = (config) => config.method === "post" ? fail(config, status, message) : adapter(config);
    await assert.rejects(write(store, "createCommunityAdminTower", { name: "" }), { status, message: Array.isArray(message) ? message.join(", ") : message });
    await settle(store);
    assert.equal(reads["/towers"], 1);
    assert.equal(JSON.stringify(store.getState()).includes("must-not-enter-redux"), false);
  });
}

test("failed reads can be retried without disturbing other cached resources", async () => {
  const store = freshStore(); const { reads } = model(), adapter = client.api.defaults.adapter;
  client.api.defaults.adapter = (config) => config.url === "/users" ? fail(config, 403, "Directory denied") : adapter(config);
  const users = query(store, names.users);
  await assert.rejects(users.unwrap(), { status: 403, message: "Directory denied" });
  await query(store, names.towers).unwrap();
  client.api.defaults.adapter = adapter;
  await users.refetch().unwrap();
  assert.equal(selected(store, "users").isSuccess, true);
  assert.equal(reads["/towers"], 1);
});

test("stale session arguments cannot start directory requests or expose cached previous-session data", async () => {
  const store = freshStore(); const state = model();
  const previous = client.getSessionRevision();
  await query(store, names.users, previous).unwrap();
  client.saveSession("another-session", { ...admin, id: "other-admin" });
  assert.equal(api.endpoints[names.users].select(client.getSessionRevision())(store.getState()).data, undefined);
  await assert.rejects(query(store, names.towers, previous).unwrap(), { status: 0, message: "The request is no longer active." });
  assert.equal(state.reads["/towers"], undefined);
});

test("Community Admin pages share reads, preserve forms, reconcile partial writes and refresh affected screens in Chromium", { timeout: 120000 }, async () => {
  const temporary = await mkdtemp(join(tmpdir(), "urbanity-directory-test-"));
  let server, browser, socket, sessionId;
  const pending = new Map();
  let nextId = 0;
  async function waitFor(check, label) {
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      if (await check()) return;
      await delay(50);
    }
    throw new Error(`Timed out: ${label}`);
  }
  function command(method, params = {}, session = sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`DevTools timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
    });
  }
  async function evaluate(expression) {
    const response = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  const text = (value) => evaluate(`document.body.innerText.includes(${JSON.stringify(value)})`);
  const waitText = (value) => waitFor(() => text(value), value);
  async function click(label, scope = "document") {
    await evaluate(`(() => { const button = [...${scope}.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(label)}); if (!button || button.disabled) throw Error('Unavailable action: ${label}'); button.click(); })()`);
    await delay(50);
  }
  async function fill(label, value) {
    await evaluate(`(() => {
      const label = [...document.querySelectorAll('[role=dialog] label')].find(el => el.textContent.trim().startsWith(${JSON.stringify(label)}));
      const el = document.getElementById(label.htmlFor);
      const prototype = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await delay(50);
  }
  const fixture = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { Provider } from 'react-redux';
    import { AuthContext } from '/src/auth/AuthContext.jsx';
    import { ToastProvider } from '/src/components/ui/ToastProvider.jsx';
    import { createAppStore } from '/src/app/store.js';
    import { api, saveSession, getSessionRevision } from '/src/api/client.js';
    import { HierarchyPage } from '/src/features/community-admin/pages/HierarchyPage.jsx';
    import { UsersPage } from '/src/features/community-admin/pages/UsersPage.jsx';
    import { WorkforcePage } from '/src/features/community-admin/pages/WorkforcePage.jsx';
    const admin = { id: 'admin', name: 'Administrator', email: 'admin@example.test', role: 'COMMUNITY_ADMIN', communityId: 'c' };
    saveSession('browser-test-session', admin);
    const state = window.directoryTest = {
      reads: {}, writes: [], actions: [], refreshes: 0, transferFails: true, denyUsers: false,
      data: {
        '/communities': [{ id: 'c', name: 'Test Community' }],
        '/towers': [{ id: 't', name: 'Tower A', code: 'A', communityId: 'c' }],
        '/floors': [{ id: 'f', label: 'Floor One', floorNumber: 1, towerId: 't' }],
        '/apartments': [{ id: 'a', apartmentNumber: '101', label: 'Original home', floorId: 'f', ownerUserId: null }],
        '/users': [admin, { id: 'resident', name: 'Resident One', email: 'resident@example.test', role: 'RESIDENT', apartmentId: 'a' }, { id: 'worker-user', name: 'Worker One', email: 'worker@example.test', role: 'MAINTENANCE_WORKER', communityId: 'c' }],
        '/workforce/workers': [{ id: 'w', userId: 'worker-user', specialization: 'PLUMBING', status: 'AVAILABLE', rating: 4, completedWorkCount: 2 }],
        '/apartments/a/ownership-history': [],
      }
    };
    api.defaults.adapter = async config => {
      const reject = (status, message) => { const error = new Error(message); error.isAxiosError = true; error.config = config; error.response = { status, data: { error: { message } } }; throw error; };
      if (config.method === 'get') {
        state.reads[config.url] = (state.reads[config.url] || 0) + 1;
        await new Promise(resolve => setTimeout(resolve, 80));
        if (config.url === '/users' && state.denyUsers) reject(403, 'Directory permission denied');
        return { status: 200, data: { data: structuredClone(state.data[config.url] || []) } };
      }
      const body = config.data ? JSON.parse(config.data) : {};
      state.writes.push({ url: config.url, method: config.method, body });
      await new Promise(resolve => setTimeout(resolve, 100));
      let result;
      if (config.url.endsWith('/ownership-transfer')) {
        if (state.transferFails) reject(409, 'Recorded owner changed');
        state.data['/apartments'][0].ownerUserId = body.newOwnerUserId;
        state.data['/apartments/a/ownership-history'].push({ id: 'h', fromOwnerUserId: null, toOwnerUserId: body.newOwnerUserId, ...body });
      } else {
        const path = Object.keys(state.data).find(path => config.url.startsWith(path + '/'));
        if (config.method === 'post') {
          const { password, ...safe } = body;
          result = { id: 'created-user', ...safe };
          state.data[config.url].push(result);
        } else {
          const id = config.url.slice(path.length + 1);
          result = state.data[path].find(item => item.id === id);
          if (config.method === 'delete') result.status = 'INACTIVE';
          else { const { password, ...safe } = body; Object.assign(result, safe); }
        }
      }
      return { status: 200, data: { data: structuredClone(result) } };
    };
    const store = createAppStore([() => next => action => { state.actions.push(JSON.stringify(action)); return next(action); }]);
    state.store = store;
    const auth = { user: admin, authenticated: true, loading: false, sessionRevision: getSessionRevision(), refreshUser: async () => { state.refreshes++; } };
    const root = createRoot(document.getElementById('root'));
    state.render = () => root.render(React.createElement(Provider, { store }, React.createElement(AuthContext.Provider, { value: { ...auth } }, React.createElement(ToastProvider, null,
      React.createElement('section', { id: 'hierarchy' }, React.createElement(HierarchyPage)),
      React.createElement('section', { id: 'users' }, React.createElement(UsersPage)),
      React.createElement('section', { id: 'workforce' }, React.createElement(WorkforcePage))
    ))));
    state.setRole = role => { auth.user = { ...admin, role }; state.render(); };
    state.render();
  `;
  try {
    server = await createServer({
      logLevel: "error", server: { host: "127.0.0.1", port: 0, strictPort: false },
      plugins: [{
        name: "community-directory-test-fixture",
        resolveId: (id) => id === "virtual:community-directory-test" ? "\0community-directory-test" : undefined,
        load: (id) => id === "\0community-directory-test" ? fixture : undefined,
        configureServer: (server) => { server.middlewares.use("/__community-directory-test", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml("/__community-directory-test", '<html><body><div id="root"></div><script type="module" src="/@id/virtual:community-directory-test"></script></body></html>'));
        }); },
      }],
    });
    await server.listen();
    const profile = join(temporary, "browser");
    browser = spawn(process.env.CHROMIUM_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", ["--headless", "--no-sandbox", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    let devtools;
    await waitFor(async () => { try { devtools = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).trim().split("\n"); return true; } catch { return false; } }, "Chromium startup");
    socket = new WebSocket(`ws://127.0.0.1:${devtools[0]}${devtools[1].trim()}`);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    socket.onmessage = ({ data }) => { const response = JSON.parse(data); const task = pending.get(response.id); if (task) { pending.delete(response.id); response.error ? task.reject(new Error(response.error.message)) : task.resolve(response.result); } };
    const target = await command("Target.createTarget", { url: "about:blank" }, null);
    ({ sessionId } = await command("Target.attachToTarget", { targetId: target.targetId, flatten: true }, null));
    await command("Page.enable");
    await command("Page.navigate", { url: `http://127.0.0.1:${server.httpServer.address().port}/__community-directory-test` });
    await waitText("Original home");
    await waitText("Worker One");
    assert.equal(await evaluate("directoryTest.reads['/users']"), 1);
    assert.equal(await evaluate("directoryTest.reads['/apartments']"), 1);

    await click("Create user");
    await click("Save");
    await waitText("Enter the user's full name.");
    assert.equal(await evaluate("directoryTest.writes.length"), 0);
    await fill("Role", "RESIDENT"); await fill("Full name", "New Resident"); await fill("Email", "new@example.test"); await fill("Password", "browser-private-password");
    await fill("Tower", "t"); await fill("Floor", "f"); await fill("Apartment", "a");
    await evaluate("document.querySelector('#community-user-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));document.querySelector('#community-user-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));");
    await waitText("User created.");
    assert.equal(await evaluate("directoryTest.writes.filter(w => w.url === '/users').length"), 1);
    await waitText("New Resident");

    await click("Edit", "document.querySelector('#users tbody tr')");
    await fill("Full name", "Updated Administrator"); await fill("New password", "browser-private-password"); await click("Save");
    await waitText("User updated.");
    assert.equal(await evaluate("directoryTest.refreshes"), 1);

    await evaluate("[...document.querySelectorAll('#hierarchy tbody tr')].find(row => row.textContent.includes('Original home')).querySelector('button').click()");
    await waitText("Edit apartment");
    await fill("Label", "Saved apartment details"); await fill("New recorded owner", "resident"); await fill("Transfer reason", "Sale");
    await click("Save"); await waitText("Apartment details were saved, but ownership transfer failed.");
    await waitFor(() => evaluate("[...document.querySelectorAll('#hierarchy td')].some(el => el.textContent === 'Saved apartment details')"), "saved apartment reconciled");
    assert.equal(await evaluate("directoryTest.data['/apartments'][0].ownerUserId"), null);
    await evaluate("directoryTest.transferFails = false"); await click("Save");
    await waitText("Apartment updated."); await waitText("101 ownership transfer history");
    assert.equal(await evaluate("directoryTest.data['/apartments'][0].ownerUserId"), "resident");

    await click("Edit", "document.querySelector('#workforce')"); await fill("Specialization", "HVAC"); await click("Save");
    await waitText("Worker profile updated."); await waitText("Hvac");
    await click("Deactivate", "document.querySelector('#workforce')"); await click("Deactivate", "document.querySelector('[role=dialog]')");
    await waitText("Worker profile deactivated.");
    await waitFor(() => evaluate("document.querySelector('#workforce tbody').innerText.includes('INACTIVE')"), "inactive worker visible");
    assert.equal(await evaluate("(directoryTest.actions.join('') + JSON.stringify(directoryTest.store.getState())).includes('browser-private-password')"), false);

    await evaluate("directoryTest.denyUsers = true; directoryTest.store.dispatch({type:'urbanityApi/resetApiState'});");
    await waitText("Directory permission denied");
    const towerReads = await evaluate("directoryTest.reads['/towers']");
    await evaluate("directoryTest.denyUsers = false"); await click("Try again", "document.querySelector('#users')");
    await waitText("Updated Administrator");
    assert.equal(await evaluate("directoryTest.reads['/towers']"), towerReads);
    await evaluate("directoryTest.setRole('RESIDENT')");
    await waitFor(() => evaluate("!document.querySelector('#users tbody')"), "private data hidden for another role");
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { try { await command("Browser.close", {}, null); } catch {} }
    socket?.close();
    if (browser && browser.exitCode === null) { browser.kill(); await delay(300); }
    await server?.close();
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
