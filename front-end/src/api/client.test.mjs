import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

// Load the actual client through Vite so import.meta.env uses the real config.
const server = await createServer({ server: { middlewareMode: true }, envDir: false });
after(() => server.close());
const { api, API_BASE_URL } = await server.ssrLoadModule("/src/api/client.js");

test("missing frontend env routes login through the configured API proxy", () => {
  assert.equal(API_BASE_URL, "/api");
  assert.equal(api.getUri({ url: "/auth/login" }), "/api/auth/login");
  assert.equal(server.config.server.proxy["/api"].rewrite("/api/auth/login"), "/auth/login");
});

test("HTTP failures remain failures and preserve backend validation messages", async () => {
  const adapter = async (config) => {
    const error = new Error("Bad request");
    error.isAxiosError = true;
    error.config = config;
    error.response = { status: 401, data: { error: { message: "Invalid credentials" } } };
    throw error;
  };
  await assert.rejects(api.post("/auth/login", {}, { adapter, authenticated: false }),
    (error) => error.status === 401 && error.message === "Invalid credentials");
});
