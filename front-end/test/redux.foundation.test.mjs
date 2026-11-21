import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { AxiosError } from "axios";
import { createServer } from "vite";

let vite;
let client;
let auth;
let stores;
let urbanityApi;
let runServiceQuery;
let communityApi;
let createCommunity;
let originalAdapter;

const firstAdmin = { id: "admin-a", role: "SUPER_ADMIN", email: "a@example.test" };
const secondAdmin = { id: "admin-b", role: "SUPER_ADMIN", email: "b@example.test" };
const firstCommunity = { id: "community-a", name: "First Community" };
const nextCommunity = { id: "community-b", name: "Next Community" };

const ok = (data) => ({ status: 200, data: { success: true, data } });

function fail(config, status, message) {
  const response = { status, data: { error: { message } } };
  throw new AxiosError("Request failed", undefined, config, undefined, response);
}

before(async () => {
  vite = await createServer({
    configFile: false,
    logLevel: "error",
    server: { middlewareMode: true, watch: null, ws: false },
  });
  client = await vite.ssrLoadModule("/src/api/client.js");
  auth = await vite.ssrLoadModule("/src/auth/authService.js");
  stores = await vite.ssrLoadModule("/src/app/store.js");
  ({ urbanityApi, runServiceQuery } = await vite.ssrLoadModule("/src/api/urbanityApi.js"));
  const feature = await vite.ssrLoadModule("/src/features/super-admin/services/superAdminCommunitiesApi.js");
  communityApi = feature.superAdminCommunitiesApi;
  createCommunity = feature.createSuperAdminCommunity;
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

const directory = () => communityApi.endpoints.listSuperAdminCommunities;
const load = (store) => store.dispatch(directory().initiate(client.getSessionRevision()));
const selected = (store, revision = client.getSessionRevision()) =>
  directory().select(revision)(store.getState());

async function settleDirectory(store) {
  await store.dispatch(urbanityApi.util.getRunningQueryThunk(
    "listSuperAdminCommunities", client.getSessionRevision(),
  ));
}

test("registers the API and shares pending and cached community reads", async () => {
  assert.equal(communityApi, urbanityApi);
  const { store } = stores;
  client.saveSession("test-bearer", firstAdmin);
  const pending = Promise.withResolvers();
  let reads = 0;
  client.api.defaults.adapter = (config) => {
    assert.equal(config.url, "/communities");
    assert.equal(config.headers.get("Authorization"), "Bearer test-bearer");
    assert.ok(config.signal);
    reads += 1;
    return pending.promise;
  };

  const first = load(store);
  const second = load(store);
  assert.equal(selected(store).isLoading, true);
  pending.resolve(ok([firstCommunity]));
  assert.deepEqual(await first.unwrap(), [firstCommunity]);
  assert.deepEqual(await second.unwrap(), [firstCommunity]);
  first.unsubscribe();
  second.unsubscribe();
  const cached = load(store);
  assert.deepEqual(await cached.unwrap(), [firstCommunity]);
  assert.equal(reads, 1);
  assert.equal(store.getState().urbanityApi.config.middlewareRegistered, true);
  cached.unsubscribe();
});

test("refreshes the directory following update and delete and preserves validation errors", async () => {
  const { store } = stores;
  client.saveSession("test-bearer", firstAdmin);
  let communities = [firstCommunity, nextCommunity];
  let reads = 0;
  client.api.defaults.adapter = async (config) => {
    if (config.method === "get") {
      assert.equal(config.url, "/communities");
      reads += 1;
      return ok(communities);
    }
    assert.equal(config.url, "/communities/community-a");
    assert.ok(config.signal);
    if (config.method === "patch") {
      const changes = JSON.parse(config.data);
      if (!changes.name) fail(config, 400, ["name is required", "name must be a string"]);
      communities = [{ ...firstCommunity, ...changes }, nextCommunity];
      return ok(communities[0]);
    }
    assert.equal(config.method, "delete");
    communities = [nextCommunity];
    return ok();
  };

  const subscription = load(store);
  await subscription.unwrap();
  const update = (changes) => store.dispatch(
    communityApi.endpoints.updateSuperAdminCommunity.initiate({ id: firstCommunity.id, changes }),
  ).unwrap();

  await assert.rejects(update({ name: "" }), {
    status: 400,
    message: "name is required, name must be a string",
  });
  assert.equal(reads, 1);
  await update({ name: "Renamed Community" });
  await settleDirectory(store);
  assert.equal(selected(store).data[0].name, "Renamed Community");

  await store.dispatch(communityApi.endpoints.deleteSuperAdminCommunity.initiate(firstCommunity.id)).unwrap();
  await settleDirectory(store);
  assert.deepEqual(selected(store).data, [nextCommunity]);
  assert.equal(reads, 3);
  subscription.unsubscribe();
});

test("reports a serializable directory error and supports a successful retry", async () => {
  const { store } = stores;
  client.saveSession("test-bearer", firstAdmin);
  client.api.defaults.adapter = async (config) => fail(config, 403, "Insufficient role permissions");
  const request = load(store);
  const error = { status: 403, message: "Insufficient role permissions" };
  await assert.rejects(request.unwrap(), error);
  assert.deepEqual(selected(store).error, error);
  assert.equal(client.getAccessToken(), "test-bearer");

  client.api.defaults.adapter = async () => ok([]);
  await request.refetch().unwrap();
  assert.deepEqual(selected(store).data, []);
  request.unsubscribe();
});

test("keeps login and community creation credentials out of Redux actions and state", async () => {
  const actions = [];
  const capture = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = stores.createAppStore([capture]);
  const password = "create-only-password";
  const loginPassword = "login-only-password";
  const bearer = "login-only-bearer";
  let communities = [firstCommunity];
  client.api.defaults.adapter = async (config) => {
    if (config.url === "/auth/login") {
      assert.equal(JSON.parse(config.data).password, loginPassword);
      assert.equal(config.headers.has("Authorization"), false);
      return ok({ accessToken: bearer, user: firstAdmin });
    }
    if (config.method === "post") {
      assert.equal(config.url, "/communities");
      assert.equal(JSON.parse(config.data).adminPassword, password);
      communities = [...communities, nextCommunity];
      return ok({ community: nextCommunity });
    }
    return ok(communities);
  };

  try {
    const response = await auth.login(firstAdmin.email, loginPassword);
    client.saveSession(response.data.accessToken, response.data.user);
    await load(store).unwrap();
    await createCommunity({ name: nextCommunity.name, adminPassword: password }, store.dispatch);
    await settleDirectory(store);

    assert.deepEqual(selected(store).data, communities);
    assert.ok(actions.some(urbanityApi.util.invalidateTags.match));
    const reduxData = JSON.stringify({ actions, state: store.getState() });
    for (const secret of [password, loginPassword, bearer, "adminPassword"]) {
      assert.equal(reduxData.includes(secret), false);
    }
  } finally {
    store.dispatch(urbanityApi.util.resetApiState());
  }
});

test("resets the production store on logout and identity or role changes", async () => {
  const { store } = stores;
  client.saveSession("same-test-token", firstAdmin);
  client.api.defaults.adapter = async () => ok([firstCommunity]);
  const firstRevision = client.getSessionRevision();
  await load(store).unwrap();

  client.saveSession("same-test-token", { ...firstAdmin, email: "updated@example.test" });
  assert.equal(client.getSessionRevision(), firstRevision);
  assert.deepEqual(selected(store).data, [firstCommunity]);

  client.saveSession("same-test-token", secondAdmin);
  assert.equal(selected(store, firstRevision).isUninitialized, true);
  const secondRevision = client.getSessionRevision();
  await load(store).unwrap();

  client.saveSession("same-test-token", { ...secondAdmin, role: "COMMUNITY_ADMIN" });
  assert.equal(selected(store, secondRevision).isUninitialized, true);
  const roleRevision = client.getSessionRevision();
  await load(store).unwrap();

  client.clearSession();
  assert.equal(client.getAccessToken(), null);
  assert.equal(selected(store, roleRevision).isUninitialized, true);
});

test("aborts pending cache work and rejects a stale success even if transport ignores abort", async () => {
  const { store } = stores;
  client.saveSession("old-test-token", firstAdmin);
  const oldRevision = client.getSessionRevision();
  const response = Promise.withResolvers();
  const oldService = Promise.withResolvers();
  const stale = runServiceQuery(new AbortController().signal, () => oldService.promise);
  let oldSignal;
  client.api.defaults.adapter = (config) => {
    oldSignal = config.signal;
    return response.promise;
  };

  const oldRequest = load(store);
  client.clearSession();
  assert.equal(oldSignal.aborted, true);
  client.saveSession("new-test-token", secondAdmin);
  client.api.defaults.adapter = async () => ok([nextCommunity]);
  await load(store).unwrap();

  response.resolve(ok([firstCommunity]));
  oldService.resolve([firstCommunity]);
  await assert.rejects(oldRequest.unwrap(), { name: "AbortError" });
  assert.deepEqual(await stale, { error: { status: 0, message: "The request is no longer active." } });
  assert.equal(selected(store, oldRevision).isUninitialized, true);
  assert.deepEqual(selected(store).data, [nextCommunity]);
  const staleSubscription = store.dispatch(directory().initiate(oldRevision));
  await assert.rejects(staleSubscription.unwrap(), {
    status: 0,
    message: "The request is no longer active.",
  });
  staleSubscription.unsubscribe();
  assert.deepEqual(selected(store).data, [nextCommunity]);
});

test("ignores an old 401 and clears the session and cache for a current 401", async () => {
  const { store } = stores;
  client.saveSession("same-test-token", firstAdmin);
  const rejection = Promise.withResolvers();
  let unauthorized = 0;
  client.setUnauthorizedHandler(() => { unauthorized += 1; });
  client.api.defaults.adapter = async (config) => {
    await rejection.promise;
    fail(config, 401, "Expired session");
  };
  const previousRefresh = auth.getCurrentUser();
  const oldFailure = assert.rejects(previousRefresh, { status: 401 });

  client.clearSession();
  client.saveSession("same-test-token", secondAdmin);
  client.api.defaults.adapter = async (config) =>
    ok(config.url === "/auth/me" ? secondAdmin : [nextCommunity]);
  assert.deepEqual((await auth.getCurrentUser()).data, secondAdmin);
  await load(store).unwrap();
  rejection.resolve();
  await oldFailure;
  assert.equal(unauthorized, 0);
  assert.deepEqual(selected(store).data, [nextCommunity]);

  const currentRevision = client.getSessionRevision();
  client.api.defaults.adapter = async (config) => fail(config, 401, "Expired session");
  await assert.rejects(auth.getCurrentUser(), { status: 401 });
  assert.equal(unauthorized, 1);
  assert.equal(client.getAccessToken(), null);
  assert.equal(selected(store, currentRevision).isUninitialized, true);
});
