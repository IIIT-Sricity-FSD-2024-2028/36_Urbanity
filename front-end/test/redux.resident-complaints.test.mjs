import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { AxiosError } from "axios";
import { createServer } from "vite";

let vite;
let client;
let stores;
let urbanityApi;
let residentApi;
let uploadAttachments;
let originalAdapter;

const residentA = { id: "resident-a", email: "a@example.test", role: "RESIDENT" };
const residentB = { id: "resident-b", email: "b@example.test", role: "RESIDENT" };
const complaintA = { id: "complaint-a", residentId: residentA.id, title: "Leaking tap", status: "IN_PROGRESS" };
const complaintB = { id: "complaint-b", residentId: residentA.id, title: "Broken light", status: "RESOLVED", resolutionVerification: { verifiedAt: "2026-11-01" } };
const ok = (data) => ({ status: 200, data: { success: true, data } });

function fail(config, status, message) {
  throw new AxiosError("Request failed", undefined, config, undefined, {
    status,
    data: { error: { message } },
  });
}

before(async () => {
  vite = await createServer({
    configFile: false,
    logLevel: "error",
    server: { middlewareMode: true, watch: null, ws: false },
  });
  client = await vite.ssrLoadModule("/src/api/client.js");
  stores = await vite.ssrLoadModule("/src/app/store.js");
  ({ urbanityApi } = await vite.ssrLoadModule("/src/api/urbanityApi.js"));
  const feature = await vite.ssrLoadModule("/src/features/resident/services/residentComplaintsApi.js");
  residentApi = feature.residentComplaintsApi;
  uploadAttachments = feature.uploadResidentComplaintAttachments;
  originalAdapter = client.api.defaults.adapter;

  const storage = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  };
});

afterEach(() => {
  client.api.defaults.adapter = originalAdapter;
  client.setUnauthorizedHandler(null);
  client.clearSession();
});

after(async () => {
  delete globalThis.window;
  await vite?.close();
});

const store = () => stores.store;
const revision = () => client.getSessionRevision();
const list = () => residentApi.endpoints.listResidentComplaints;
const detail = () => residentApi.endpoints.getResidentComplaint;
const review = () => residentApi.endpoints.getResidentComplaintReview;
const attachments = () => residentApi.endpoints.getResidentComplaintAttachments;
const hierarchy = () => residentApi.endpoints.getResidentHierarchy;
const loadList = () => store().dispatch(list().initiate(revision()));
const loadDetail = (id) => store().dispatch(detail().initiate({ id, sessionRevision: revision() }));
const loadReview = (id) => store().dispatch(review().initiate({ id, sessionRevision: revision() }));
const loadAttachments = (id) => store().dispatch(attachments().initiate({ id, sessionRevision: revision() }));

async function settle(endpointName, arg) {
  await store().dispatch(urbanityApi.util.getRunningQueryThunk(endpointName, arg));
}

test("shares one cached complaint list across Resident dashboard and complaints readers", async () => {
  client.saveSession("resident-a-token", residentA);
  let reads = 0;
  client.api.defaults.adapter = async (config) => {
    assert.equal(config.url, "/complaints");
    reads += 1;
    return ok([complaintA, complaintB]);
  };

  const dashboard = loadList();
  const complaintsPage = loadList();
  assert.deepEqual(await dashboard.unwrap(), [complaintA, complaintB]);
  assert.deepEqual(await complaintsPage.unwrap(), [complaintA, complaintB]);
  assert.equal(reads, 1);
  dashboard.unsubscribe();
  complaintsPage.unsubscribe();
});

test("fetches details by complaint ID and keeps rapid switches in separate cache entries", async () => {
  client.saveSession("resident-a-token", residentA);
  const pending = new Map();
  client.api.defaults.adapter = (config) => new Promise((resolve) => {
    const id = config.url.split("/").at(-1);
    pending.set(id, () => resolve(ok(id === complaintA.id ? complaintA : complaintB)));
  });

  const first = loadDetail(complaintA.id);
  const second = loadDetail(complaintB.id);
  pending.get(complaintB.id)();
  assert.deepEqual(await second.unwrap(), complaintB);
  pending.get(complaintA.id)();
  assert.deepEqual(await first.unwrap(), complaintA);
  assert.equal(detail().select({ id: complaintA.id, sessionRevision: revision() })(store().getState()).data.id, complaintA.id);
  assert.equal(detail().select({ id: complaintB.id, sessionRevision: revision() })(store().getState()).data.id, complaintB.id);
  first.unsubscribe();
  second.unsubscribe();
});

test("caches authenticated hierarchy data and exposes a tag for explicit refresh", async () => {
  client.saveSession("resident-a-token", residentA);
  const expected = { user: residentA, community: { name: "North" }, tower: { name: "A" } };
  let reads = 0;
  client.api.defaults.adapter = async (config) => {
    assert.equal(config.url, "/users/me/hierarchy");
    reads += 1;
    return ok(expected);
  };
  const request = store().dispatch(hierarchy().initiate(revision()));
  assert.deepEqual(await request.unwrap(), expected);
  const cached = store().dispatch(hierarchy().initiate(revision()));
  assert.deepEqual(await cached.unwrap(), expected);
  assert.equal(reads, 1);
  request.unsubscribe();
  cached.unsubscribe();
});

test("creates complaints with only backend-supported fields and refreshes the cached list", async () => {
  client.saveSession("resident-a-token", residentA);
  let complaints = [complaintA];
  let listReads = 0;
  client.api.defaults.adapter = async (config) => {
    if (config.method === "get" && config.url === "/complaints") {
      listReads += 1;
      return ok(complaints);
    }
    assert.equal(config.method, "post");
    assert.equal(config.url, "/complaints");
    const payload = JSON.parse(config.data);
    assert.deepEqual(Object.keys(payload).sort(), ["description", "requiredWorkType", "title", "type"]);
    assert.deepEqual(payload, {
      type: "PLUMBING",
      title: "Blocked drain",
      description: "Water is backing up.",
      requiredWorkType: "PLUMBING",
    });
    const created = { id: "complaint-new", residentId: residentA.id, ...payload };
    complaints = [...complaints, created];
    return ok(created);
  };
  const activeList = loadList();
  await activeList.unwrap();
  const payload = { type: "PLUMBING", title: "Blocked drain", description: "Water is backing up.", requiredWorkType: "PLUMBING" };
  const created = await store().dispatch(residentApi.endpoints.createResidentComplaint.initiate({ payload, sessionRevision: revision() })).unwrap();
  await settle("listResidentComplaints", revision());
  assert.equal(created.id, "complaint-new");
  assert.equal(listReads, 2);
  assert.deepEqual(list().select(revision())(store().getState()).data.at(-1), created);
  activeList.unsubscribe();
});

test("preserves exact missing-review translation and passes through unrelated review failures", async () => {
  client.saveSession("resident-a-token", residentA);
  client.api.defaults.adapter = async (config) => {
    if (config.url.endsWith("/complaint-missing/review")) fail(config, 400, "Complaint review was not found");
    if (config.url.endsWith("/complaint-other/review")) fail(config, 400, "Invalid review values");
    if (config.url.endsWith("/complaint-server/review")) fail(config, 503, "Review service unavailable");
    return ok(null);
  };
  const missing = loadReview("complaint-missing");
  assert.equal(await missing.unwrap(), null);
  assert.equal(review().select({ id: "complaint-missing", sessionRevision: revision() })(store().getState()).data, null);
  const invalid = loadReview("complaint-other");
  await assert.rejects(invalid.unwrap(), { status: 400, message: "Invalid review values" });
  const unavailable = loadReview("complaint-server");
  await assert.rejects(unavailable.unwrap(), { status: 503, message: "Review service unavailable" });
  missing.unsubscribe();
  invalid.unsubscribe();
  unavailable.unsubscribe();
});

test("review submission refreshes review, complaint detail, and resident list", async () => {
  client.saveSession("resident-a-token", residentA);
  let listReads = 0;
  let reviewReads = 0;
  let detailReads = 0;
  client.api.defaults.adapter = async (config) => {
    if (config.url === "/complaints") { listReads += 1; return ok([complaintB]); }
    if (config.url === `/complaints/${complaintB.id}`) { detailReads += 1; return ok(complaintB); }
    if (config.url.endsWith("/review") && config.method === "get") { reviewReads += 1; return ok(null); }
    if (config.url.endsWith("/review") && config.method === "post") {
      assert.deepEqual(JSON.parse(config.data), { speedRating: 5, qualityRating: 4, communicationRating: 5, feedback: "Helpful" });
      return ok({ id: "review-b", rating: 5 });
    }
    throw new Error(`Unexpected request ${config.method} ${config.url}`);
  };
  const activeList = loadList();
  const activeDetail = loadDetail(complaintB.id);
  const activeReview = loadReview(complaintB.id);
  await Promise.all([activeList.unwrap(), activeDetail.unwrap(), activeReview.unwrap()]);
  await store().dispatch(residentApi.endpoints.submitResidentComplaintReview.initiate({
    id: complaintB.id,
    payload: { speedRating: 5, qualityRating: 4, communicationRating: 5, feedback: "Helpful" },
    sessionRevision: revision(),
  })).unwrap();
  await Promise.all([
    settle("listResidentComplaints", revision()),
    settle("getResidentComplaint", { id: complaintB.id, sessionRevision: revision() }),
    settle("getResidentComplaintReview", { id: complaintB.id, sessionRevision: revision() }),
  ]);
  assert.equal(listReads, 2);
  assert.equal(detailReads, 2);
  assert.equal(reviewReads, 2);
  activeList.unsubscribe();
  activeDetail.unsubscribe();
  activeReview.unsubscribe();
});

test("attachment metadata is cached; failed uploads can be retried without another complaint create", async () => {
  client.saveSession("resident-a-token", residentA);
  const files = [new File(["first"], "first.png", { type: "image/png" }), new File(["second"], "second.png", { type: "image/png" })];
  let listReads = 0;
  let metadataReads = 0;
  let creates = 0;
  let secondUploadFails = true;
  let uploadCount = 0;
  let metadata = [];
  client.api.defaults.adapter = async (config) => {
    if (config.url === "/complaints" && config.method === "get") { listReads += 1; return ok([complaintA]); }
    if (config.url === "/complaints" && config.method === "post") { creates += 1; return ok({ id: complaintA.id }); }
    if (config.url === `/complaints/${complaintA.id}/attachments` && config.method === "get") { metadataReads += 1; return ok(metadata); }
    if (config.url === `/complaints/${complaintA.id}/attachments` && config.method === "post") {
      uploadCount += 1;
      const file = config.data.get("file");
      if (file.name === "second.png" && secondUploadFails) fail(config, 500, "Upload failed");
      metadata = [...metadata, { id: `attachment-${uploadCount}`, originalName: file.name }];
      return ok(metadata.at(-1));
    }
    throw new Error(`Unexpected request ${config.method} ${config.url}`);
  };

  const complaintList = loadList();
  await complaintList.unwrap();
  const attached = loadAttachments(complaintA.id);
  await attached.unwrap();
  await store().dispatch(residentApi.endpoints.createResidentComplaint.initiate({
    payload: { type: "PLUMBING", title: "Leaking tap", description: "Water is leaking.", requiredWorkType: "PLUMBING" },
    sessionRevision: revision(),
  })).unwrap();
  await settle("listResidentComplaints", revision());
  const failed = await uploadAttachments(store().dispatch, complaintA.id, files, revision());
  assert.deepEqual(failed.map((result) => result.status), ["fulfilled", "rejected"]);
  await settle("getResidentComplaintAttachments", { id: complaintA.id, sessionRevision: revision() });
  assert.deepEqual(attachments().select({ id: complaintA.id, sessionRevision: revision() })(store().getState()).data.map((item) => item.originalName), ["first.png"]);

  secondUploadFails = false;
  const retried = await uploadAttachments(store().dispatch, complaintA.id, [files[1]], revision());
  assert.deepEqual(retried.map((result) => result.status), ["fulfilled"]);
  await settle("getResidentComplaintAttachments", { id: complaintA.id, sessionRevision: revision() });
  assert.deepEqual(attachments().select({ id: complaintA.id, sessionRevision: revision() })(store().getState()).data.map((item) => item.originalName), ["first.png", "second.png"]);
  assert.equal(creates, 1);
  assert.equal(listReads, 2);
  assert.equal(metadataReads, 3);
  complaintList.unsubscribe();
  attached.unsubscribe();
});

test("keeps data isolated across resident sessions and reports cross-resident authorization errors", async () => {
  client.saveSession("resident-a-token", residentA);
  let call = 0;
  client.api.defaults.adapter = async (config) => {
    call += 1;
    if (config.url === "/complaints") return ok(call === 1 ? [complaintA] : [{ ...complaintA, residentId: residentB.id, title: "Other resident" }]);
    if (config.url === `/complaints/${complaintA.id}` && config.headers.get("Authorization") === "Bearer resident-b-token") {
      fail(config, 403, "You cannot access this complaint");
    }
    return ok(complaintA);
  };
  const first = loadList();
  assert.deepEqual(await first.unwrap(), [complaintA]);
  first.unsubscribe();

  client.saveSession("resident-b-token", residentB);
  const second = loadList();
  assert.deepEqual(await second.unwrap(), [{ ...complaintA, residentId: residentB.id, title: "Other resident" }]);
  assert.equal(list().select(revision())(store().getState()).data[0].title, "Other resident");
  const forbidden = loadDetail(complaintA.id);
  await assert.rejects(forbidden.unwrap(), { status: 403, message: "You cannot access this complaint" });
  assert.equal(list().select(revision())(store().getState()).data.some((item) => item.title === complaintA.title), false);
  second.unsubscribe();
  forbidden.unsubscribe();
});

test("failed complaint creation remains a visible mutation error and does not invalidate the list", async () => {
  client.saveSession("resident-a-token", residentA);
  let reads = 0;
  client.api.defaults.adapter = async (config) => {
    if (config.method === "get") { reads += 1; return ok([complaintA]); }
    fail(config, 400, "Title is required");
  };
  const activeList = loadList();
  await activeList.unwrap();
  await assert.rejects(store().dispatch(residentApi.endpoints.createResidentComplaint.initiate({
    payload: { type: "PLUMBING", title: "", description: "issue", requiredWorkType: "PLUMBING" },
    sessionRevision: revision(),
  })).unwrap(), { status: 400, message: "Title is required" });
  assert.equal(reads, 1);
  assert.equal(list().select(revision())(store().getState()).data[0].id, complaintA.id);
  activeList.unsubscribe();
});
