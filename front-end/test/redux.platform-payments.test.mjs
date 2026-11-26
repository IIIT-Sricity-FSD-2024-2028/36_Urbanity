import assert from "node:assert/strict";
import { test } from "node:test";
import { AxiosError } from "axios";
import { createServer } from "vite";

test("platform payment caches follow confirmation, failure, and session reset", async (t) => {
  const vite = await createServer({ configFile: false, logLevel: "error", server: { middlewareMode: true, watch: null, ws: false } });
  t.after(() => vite.close());
  const client = await vite.ssrLoadModule("/src/api/client.js");
  const { store } = await vite.ssrLoadModule("/src/app/store.js");
  const { platformPaymentsApi: api } = await vite.ssrLoadModule("/src/features/community-admin/services/platformPaymentsApi.js");
  const storage = new Map();
  globalThis.window = { sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } };
  const previousAdapter = client.api.defaults.adapter;
  t.after(() => {
    client.clearSession();
    client.api.defaults.adapter = previousAdapter;
    delete globalThis.window;
  });
  client.saveSession("first-session", { id: "first-admin", email: "first@example.test", role: "COMMUNITY_ADMIN" });
  const sessionRevision = client.getSessionRevision();
  const initialPayment = { id: "initial", phase: "INITIAL", amountMinor: 90000 };
  const receipt = { id: "remaining", phase: "REMAINING", amountMinor: 360000 };
  const summary = { totalMinor: 450000, outstandingMinor: 360000, paymentStatus: "BALANCE_PAYMENT_PENDING" };
  const reads = { summary: 0, history: 0 };
  let fail = true;
  client.api.defaults.adapter = async (config) => {
    const reply = (data) => ({ status: 200, data: { success: true, data } });
    if (config.url === "/platform-payments/summary") {
      reads.summary++;
      return reply({ ...summary });
    }
    if (config.url === "/platform-payments/history") {
      reads.history++;
      return reply(summary.outstandingMinor ? [initialPayment] : [initialPayment, receipt]);
    }
    assert.equal(config.url, "/platform-payments/mock-balance");
    assert.deepEqual(JSON.parse(config.data), { confirmed: true });
    if (fail) {
      throw new AxiosError("Request failed", undefined, config, undefined, {
        status: 409, data: { error: { message: "Payment did not complete" } },
      });
    }
    summary.outstandingMinor = 0;
    summary.paymentStatus = "FULLY_PAID";
    return reply(receipt);
  };

  const summaryEndpoint = api.endpoints.getPlatformPaymentSummary;
  const historyEndpoint = api.endpoints.getPlatformPaymentHistory;
  const subscribe = (endpoint) => store.dispatch(endpoint.initiate(sessionRevision));
  await Promise.all([subscribe(summaryEndpoint), subscribe(historyEndpoint)]);
  const pay = () => store.dispatch(api.endpoints.payPlatformBalance.initiate({ sessionRevision, registrationLinked: true })).unwrap();
  await assert.rejects(pay, { status: 409, message: "Payment did not complete" });
  assert.deepEqual(reads, { summary: 1, history: 1 });

  fail = false;
  assert.deepEqual(await pay(), receipt);
  await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
  const state = store.getState();
  assert.equal(summaryEndpoint.select(sessionRevision)(state).data.paymentStatus, "FULLY_PAID");
  assert.deepEqual(historyEndpoint.select(sessionRevision)(state).data, [initialPayment, receipt]);
  assert.deepEqual(reads, { summary: 2, history: 2 });

  client.saveSession("second-session", { id: "second-admin", email: "second@example.test", role: "COMMUNITY_ADMIN" });
  assert.equal(historyEndpoint.select(sessionRevision)(store.getState()).isUninitialized, true);
  await assert.rejects(subscribe(summaryEndpoint).unwrap(), { status: 0 });
  assert.deepEqual(reads, { summary: 2, history: 2 });
});
