import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { AxiosError } from "axios";
import { createServer } from "vite";

let vite, client, store, api, originalAdapter;
const user = { id: "admin-1", role: "COMMUNITY_ADMIN", email: "admin@example.test" };
const ok = (data) => ({ status: 200, data: { success: true, data } });

before(async () => {
  vite = await createServer({ configFile: false, logLevel: "error", server: { middlewareMode: true, watch: null, ws: false } });
  client = await vite.ssrLoadModule("/src/api/client.js");
  ({ store } = await vite.ssrLoadModule("/src/app/store.js"));
  ({ complaintEstimatesApi: api } = await vite.ssrLoadModule("/src/features/complaint-estimates/services/complaintEstimatesApi.js"));
  originalAdapter = client.api.defaults.adapter;
  const storage = new Map();
  globalThis.window = { sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } };
  client.saveSession("estimate-session", user);
});

after(async () => {
  client.api.defaults.adapter = originalAdapter;
  client.clearSession();
  delete globalThis.window;
  await vite.close();
});

test("approval and mock payment refetch queue and selected complaint, preserve errors and clear on session reset", async (t) => {
  t.after(() => store.dispatch(api.util.resetApiState()));
  const args = { role: user.role, sessionRevision: client.getSessionRevision() };
  const detail = { ...args, id: "complaint-1" };
  const mutation = { ...detail, estimateId: "estimate-1" };
  const initiate = (name, payload) => store.dispatch(api.endpoints[name].initiate(payload));
  const select = (name, payload) => api.endpoints[name].select(payload)(store.getState());
  const settle = () => Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
  const reads = { queue: 0, detail: 0 };
  let status = "PENDING_COMMUNITY_ADMIN_APPROVAL", reject = true;

  client.api.defaults.adapter = async (config) => {
    if (config.url === "/complaints/estimates/queue") {
      reads.queue++;
      return ok([{ status }]);
    }
    if (config.url === "/complaints/complaint-1/estimate") {
      reads.detail++;
      return ok({ status });
    }
    if (config.url === "/complaints/complaint-1/estimates/estimate-1/admin-decision") {
      assert.equal(config.method, "patch");
      assert.deepEqual(JSON.parse(config.data), { decision: "APPROVE" });
      if (reject) throw new AxiosError("Request failed", undefined, config, undefined, {
        status: 400, data: { error: { message: "Review the approved amount." } },
      });
      status = "APPROVED_FOR_PAYMENT";
      return ok({ status });
    }
    assert.equal(config.url, "/complaints/complaint-1/estimates/estimate-1/mock-payment");
    assert.equal(config.method, "post");
    assert.deepEqual(JSON.parse(config.data), { confirmed: true });
    status = "PAID";
    return ok({ reference: "MOCK-receipt" });
  };

  await Promise.all([initiate("listComplaintEstimates", args), initiate("getComplaintEstimate", detail)]);
  const approve = () => initiate("changeComplaintEstimate", { ...mutation, operation: "adminDecision", payload: { decision: "APPROVE" } }).unwrap();
  await assert.rejects(approve, { status: 400, message: "Review the approved amount." });
  assert.deepEqual(reads, { queue: 1, detail: 1 });
  reject = false;
  await approve();
  await settle();
  assert.equal(select("getComplaintEstimate", detail).data.status, "APPROVED_FOR_PAYMENT");
  assert.deepEqual(await initiate("changeComplaintEstimate", { ...mutation, operation: "pay" }).unwrap(), { reference: "MOCK-receipt" });
  await settle();
  assert.deepEqual(reads, { queue: 3, detail: 3 });
  assert.equal(select("listComplaintEstimates", args).data[0].status, "PAID");
  assert.equal(select("getComplaintEstimate", detail).data.status, "PAID");
  client.clearSession();
  assert.equal(select("getComplaintEstimate", detail).isUninitialized, true);
  await assert.rejects(initiate("getComplaintEstimate", detail).unwrap(), { status: 0 });
  assert.deepEqual(reads, { queue: 3, detail: 3 });
});
