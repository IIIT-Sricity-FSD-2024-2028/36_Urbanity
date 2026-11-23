import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { AxiosError } from "axios";
import { createServer } from "vite";
import { COMPLETED_STATUSES, VERIFIED_STATUSES } from "../src/features/maintenance-worker/utils/workflow.js";

let vite, client, stores, feature, api, originalAdapter;
const worker = { id: "worker-1", email: "worker@example.test", role: "MAINTENANCE_WORKER" };
const otherWorker = { id: "worker-2", email: "other@example.test", role: "MAINTENANCE_WORKER" };
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
  feature = await vite.ssrLoadModule("/src/features/maintenance-worker/services/workerTasksApi.js");
  api = feature.workerTasksApi;
  originalAdapter = client.api.defaults.adapter;
  const storage = new Map();
  globalThis.window = { sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } };
});
beforeEach(() => client.saveSession("worker-session", worker));
afterEach(() => {
  for (const store of testStores.splice(0)) store.dispatch(api.util.resetApiState());
  client.api.defaults.adapter = originalAdapter;
  client.clearSession();
});
after(async () => { delete globalThis.window; await vite?.close(); });

const testStores = [];
function freshStore() {
  const store = stores.createAppStore();
  testStores.push(store);
  return store;
}
const revision = () => client.getSessionRevision();
const initiate = (store, endpoint, args) => store.dispatch(api.endpoints[endpoint].initiate(args));
const list = (store) => initiate(store, "listMaintenanceWorkerTasks", revision());
const detail = (store, id) => initiate(store, "getMaintenanceWorkerTask", { id, sessionRevision: revision() });
const attachments = (store, id) => initiate(store, "getMaintenanceWorkerTaskAttachments", { id, sessionRevision: revision() });
const profile = (store) => initiate(store, "getMaintenanceWorkerProfile", revision());
const select = (store, endpoint, arg) => api.endpoints[endpoint].select(arg)(store.getState());
const selectedList = (store) => select(store, "listMaintenanceWorkerTasks", revision());
const selectedDetail = (store, id, rev = revision()) => select(store, "getMaintenanceWorkerTask", { id, sessionRevision: rev });
async function settle(store) {
  let pending;
  do {
    pending = store.dispatch(api.util.getRunningQueriesThunk());
    await Promise.all(pending);
  } while (pending.length);
}

function backend() {
  const tasks = {
    a: { id: "a", title: "Leak", assignedWorkerId: worker.id, communityId: "community", status: "ASSIGNED" },
    b: { id: "b", title: "Socket", assignedWorkerId: worker.id, communityId: "community", status: "IN_PROGRESS" },
  };
  const reads = {}, writes = [], controls = { failList: false, failUpload: false, deny: false };
  const count = (key) => { reads[key] = (reads[key] || 0) + 1; };
  client.api.defaults.adapter = async (config) => {
    const url = config.url;
    count(`${config.method}:${url}`);
    if (config.method === "get" && url === "/complaints") {
      if (controls.failList) fail(config, 503, "Task refresh failed.");
      return ok(structuredClone(Object.values(tasks)));
    }
    if (config.method === "get" && url === "/workforce/workers/me") {
      return ok({ id: worker.id, name: "Worker One", communityId: "community" });
    }
    const attachment = url.match(/^\/complaints\/([^/]+)\/attachments$/);
    if (config.method === "get" && attachment) {
      if (controls.deny && attachment[1] === "unassigned") fail(config, 403, "Only the assigned worker may access this complaint.");
      return ok([{ id: `proof-${attachment[1]}`, purpose: "RESOLUTION_PROOF", uploadedByRole: "MAINTENANCE_WORKER" }]);
    }
    const task = url.match(/^\/complaints\/([^/]+)$/);
    if (config.method === "get" && task) {
      if (controls.deny || !tasks[task[1]]) fail(config, 403, "Complaint access denied.");
      return ok(structuredClone(tasks[task[1]]));
    }
    const action = url.match(/^\/complaints\/([^/]+)\/(start|resolve)$/);
    if (config.method === "patch" && action) {
      if (controls.deny) fail(config, 403, "Only the assigned worker may update this complaint.");
      const body = JSON.parse(config.data);
      writes.push({ url, body });
      if (action[2] === "start") tasks[action[1]].status = "IN_PROGRESS";
      else tasks[action[1]].status = "PENDING_VERIFICATION";
      return ok(structuredClone(tasks[action[1]]));
    }
    if (config.method === "post" && attachment) {
      if (controls.failUpload) fail(config, 413, "Image is too large.");
      assert.ok(config.data instanceof FormData);
      return ok({ id: "uploaded-1" });
    }
    assert.fail(`Unexpected request: ${config.method} ${url}`);
  };
  return { tasks, reads, writes, controls };
}

test("assigned task data is cached and shared by dashboard and task list subscribers", async () => {
  const store = freshStore(), { reads } = backend();
  await Promise.all([list(store).unwrap(), list(store).unwrap(), list(store).unwrap()]);
  assert.equal(selectedList(store).data.length, 2);
  assert.equal(reads["get:/complaints"], 1);
});

test("complaint details are keyed by ID and rapidly switching IDs cannot reuse stale data", async () => {
  const store = freshStore(), { reads } = backend();
  const [a, b] = await Promise.all([detail(store, "a").unwrap(), detail(store, "b").unwrap()]);
  assert.equal(a.id, "a");
  assert.equal(b.id, "b");
  assert.equal(selectedDetail(store, "a").data.title, "Leak");
  assert.equal(selectedDetail(store, "b").data.title, "Socket");
  assert.equal(reads["get:/complaints/a"], 1);
  assert.equal(reads["get:/complaints/b"], 1);
});

test("worker profile is cached by session revision", async () => {
  const store = freshStore(), { reads } = backend();
  await Promise.all([profile(store).unwrap(), profile(store).unwrap()]);
  assert.equal(reads["get:/workforce/workers/me"], 1);
});

test("starting a task invalidates its details and the shared task list", async () => {
  const store = freshStore(), model = backend();
  await Promise.all([list(store).unwrap(), detail(store, "a").unwrap()]);
  await store.dispatch(api.endpoints.startMaintenanceWorkerTask.initiate({ id: "a", sessionRevision: revision() })).unwrap();
  await settle(store);
  assert.equal(selectedDetail(store, "a").data.status, "IN_PROGRESS");
  assert.equal(selectedList(store).data.find(({ id }) => id === "a").status, "IN_PROGRESS");
  assert.equal(model.reads["get:/complaints"], 2);
  assert.equal(model.reads["get:/complaints/a"], 2);
});

test("resolution preserves the three-field payload and remains pending verification", async () => {
  const store = freshStore(), model = backend();
  await Promise.all([list(store).unwrap(), detail(store, "b").unwrap()]);
  await store.dispatch(api.endpoints.resolveMaintenanceWorkerTask.initiate({
    id: "b", sessionRevision: revision(), problemFound: "Loose wire", resolutionSummary: "Reconnected safely", proofAttachmentIds: ["proof-1"],
  })).unwrap();
  await settle(store);
  assert.deepEqual(model.writes[0], {
    url: "/complaints/b/resolve", body: { problemFound: "Loose wire", resolutionSummary: "Reconnected safely", proofAttachmentIds: ["proof-1"] },
  });
  assert.equal(selectedDetail(store, "b").data.status, "PENDING_VERIFICATION");
  assert.equal(selectedList(store).data.find(({ id }) => id === "b").status, "PENDING_VERIFICATION");
  assert.equal(COMPLETED_STATUSES.includes(selectedDetail(store, "b").data.status), true);
  assert.equal(VERIFIED_STATUSES.includes(selectedDetail(store, "b").data.status), false);
});

test("upload stays outside Redux and refreshes only the task attachment metadata", async () => {
  const store = freshStore(), model = backend();
  await Promise.all([attachments(store, "b").unwrap(), attachments(store, "a").unwrap()]);
  await feature.uploadWorkerProof(store.dispatch, "b", new Blob(["image"]));
  await settle(store);
  assert.equal(model.reads["get:/complaints/b/attachments"], 2);
  assert.equal(model.reads["get:/complaints/a/attachments"], 1);
  const stateText = JSON.stringify(store.getState());
  assert.equal(stateText.includes("Blob"), false);
  assert.equal(stateText.includes("FormData"), false);
});

test("failed attachment uploads retain the existing service error", async () => {
  const store = freshStore(), model = backend();
  model.controls.failUpload = true;
  await assert.rejects(feature.uploadWorkerProof(store.dispatch, "b", new Blob(["image"])), /Image is too large/);
  assert.equal(model.reads["get:/complaints/b/attachments"] || 0, 0);
});

test("failed refresh keeps prior list data available", async () => {
  const store = freshStore(), model = backend();
  await list(store).unwrap();
  model.controls.failList = true;
  await store.dispatch(api.endpoints.listMaintenanceWorkerTasks.initiate(revision(), { forceRefetch: true })).unwrap().catch(() => {});
  assert.equal(selectedList(store).data.length, 2);
  assert.equal(selectedList(store).isError, true);
});

test("backend authorization failures for unassigned complaint details are surfaced", async () => {
  const store = freshStore(), model = backend();
  model.controls.deny = true;
  await assert.rejects(detail(store, "unassigned").unwrap(), { status: 403, message: "Complaint access denied." });
});

test("failed mutations return errors and can be retried after controls are re-enabled", async () => {
  const store = freshStore(), model = backend();
  model.controls.deny = true;
  await assert.rejects(store.dispatch(api.endpoints.startMaintenanceWorkerTask.initiate({ id: "a", sessionRevision: revision() })).unwrap(), {
    status: 403, message: "Only the assigned worker may update this complaint.",
  });
  model.controls.deny = false;
  await store.dispatch(api.endpoints.startMaintenanceWorkerTask.initiate({ id: "a", sessionRevision: revision() })).unwrap();
  assert.equal(model.tasks.a.status, "IN_PROGRESS");
});

test("switching sessions gives the new worker a separate cache and hides previous worker data", async () => {
  const store = freshStore(), oldRevision = revision(), { reads } = backend();
  await list(store).unwrap();
  client.clearSession();
  client.saveSession("other-worker-session", otherWorker);
  store.dispatch(api.util.resetApiState());
  assert.notEqual(revision(), oldRevision);
  await list(store).unwrap();
  assert.equal(selectedList(store).data.length, 2);
  assert.equal(select(store, "listMaintenanceWorkerTasks", oldRevision).isUninitialized, true);
  assert.equal(reads["get:/complaints"], 2);
});
