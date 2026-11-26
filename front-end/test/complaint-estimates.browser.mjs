// Run from front-end: node --test test/complaint-estimates.browser.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { build, preview } from "vite";

const title = "Browser test kitchen leak";
const adminPath = "/community-admin/complaints";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVFAAAAAASUVORK5CYII=";
const accounts = {
  worker: ["maintenance.worker@urbanity.local", "maintenance-worker-dev"],
  tower: ["tower.representative@urbanity.local", "tower-representative-dev"],
  admin: ["community.admin@urbanity.local", "community-admin-dev"],
  resident: ["resident@urbanity.local", "resident-dev"],
};

async function waitFor(check, label, milliseconds = 20_000) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(80);
  }
  assert.fail(`Timed out waiting for ${label}`);
}

test("complaint creation through closure with estimates and mock payment across the four role portals", { timeout: 180_000 }, async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "urbanity-estimate-ui-"));
  let vite, browser, socket;
  const backend = spawn(process.execPath, ["-r", "ts-node/register/transpile-only", "-e", `
    const { Test } = require('@nestjs/testing');
    const { AppModule } = require('./src/app.module');
    const { validationPipe } = require('./src/common/pipes/validation.pipe');
    const { LOG_DIRECTORY } = require('./src/common/logging/logging.constants');
    (async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(LOG_DIRECTORY).useValue(process.env.TEST_LOG_DIRECTORY).compile();
      const app = module.createNestApplication({ logger: false });
      app.useGlobalPipes(validationPipe);
      await app.listen(0, '127.0.0.1');
      console.log('ESTIMATE_API_PORT=' + app.getHttpServer().address().port);
    })().catch((error) => { console.error(error.message); process.exit(1); });
  `], {
    cwd: resolve("../back-end"), windowsHide: true,
    env: { ...process.env, TEST_LOG_DIRECTORY: join(temporary, "logs") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    socket?.close();
    browser?.kill();
    backend.kill();
    if (vite) await new Promise((done) => vite.httpServer.close(done));
  });
  let port, startupError = "";
  backend.stdout.on("data", (chunk) => { port ||= String(chunk).match(/ESTIMATE_API_PORT=(\d+)/)?.[1]; });
  backend.stderr.on("data", (chunk) => { startupError += String(chunk); });
  await waitFor(() => {
    assert.equal(backend.exitCode, null, startupError || "Test backend exited during startup");
    return port;
  }, "backend startup", 60_000);

  const api = `http://127.0.0.1:${port}`;
  process.env.VITE_API_URL = "/api";
  const outDir = join(temporary, "dist");
  await build({ logLevel: "error", build: { outDir, emptyOutDir: true } });
  vite = await preview({
    logLevel: "error",
    build: { outDir },
    preview: { host: "127.0.0.1", port: 0, proxy: {
      "/api": { target: api, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, "") },
    } },
  });
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const backendCall = async (path, method, payload, token) => {
    const response = await fetch(api + path, {
      method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });
    assert.ok(response.ok, `${method} ${path} returned HTTP ${response.status}`);
    return (await response.json()).data;
  };
  const sessions = Object.fromEntries(await Promise.all(Object.entries(accounts).map(async ([role, [email, password]]) =>
    [role, await backendCall("/auth/login", "POST", { email, password })])));

  browser = spawn(process.env.CHROMIUM_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
    "--headless", "--no-sandbox", "--disable-gpu", "--disable-extensions", "--no-first-run",
    "--remote-debugging-port=0", `--user-data-dir=${join(temporary, "browser")}`, "about:blank",
  ], { windowsHide: true, stdio: "ignore" });
  const debugPort = await waitFor(async () => {
    const contents = await readFile(join(temporary, "browser", "DevToolsActivePort"), "utf8").catch(() => "");
    return contents.split("\n")[0];
  }, "Edge startup");
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  socket = new WebSocket(pages.find(({ type }) => type === "page").webSocketDebuggerUrl);
  await new Promise((connect, reject) => { socket.onopen = connect; socket.onerror = reject; });

  let sequence = 0;
  const pending = new Map();
  const calls = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Network.requestWillBeSent") {
      const { method, url } = message.params.request;
      calls.push({ method, url });
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  };
  const command = (method, params) => new Promise((resolve, reject) => {
    const request = ++sequence;
    pending.set(request, { resolve, reject });
    socket.send(JSON.stringify({ id: request, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true });
    assert.ok(!result.exceptionDetails, result.exceptionDetails?.exception?.description);
    return result.result.value;
  };
  const navigate = async (path) => {
    const url = origin + path;
    const navigation = await command("Page.navigate", { url });
    assert.equal(navigation.errorText, undefined, `Unable to navigate to ${path}`);
    await waitFor(() => evaluate(`location.href === ${JSON.stringify(url)} && document.body !== null`), `loaded route ${path}`);
  };
  const textVisible = (text) => evaluate(`document.body?.innerText.includes(${JSON.stringify(text)})`);
  const waitText = (text) => waitFor(() => textVisible(text), text);
  const click = (text, scope = "body", count = 1) => waitFor(() => evaluate(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(scope + " button")})].find(el =>
      !el.disabled && (el.textContent.trim() === ${JSON.stringify(text)} || el.getAttribute("aria-label") === ${JSON.stringify(text)}));
    if (!button) return false;
    for (let i = 0; i < ${count}; i++) button.click();
    return true;
  })()`), text);
  const fill = (label, value, index = 0) => waitFor(() => evaluate(`(() => {
    const labels = [...document.querySelectorAll("label")].filter(el => el.textContent.replace("*", "").trim() === ${JSON.stringify(label)});
    const input = labels[${index}]?.control;
    if (!input) return false;
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    return true;
  })()`), label);
  const selectRadio = (name, value) => waitFor(() => evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(`input[type="radio"][name="${name}"][value="${value}"]`)});
    if (!input || input.disabled) return false;
    input.click();
    return true;
  })()`), name);
  const switchTo = async (role, path) => {
    const { accessToken, user } = sessions[role];
    await evaluate(`sessionStorage.setItem("accessToken", ${JSON.stringify(accessToken)});
      sessionStorage.setItem("currentUser", ${JSON.stringify(JSON.stringify({ id: user.id, email: user.email, role: user.role }))}); true`);
    await navigate(path);
  };

  await command("Network.enable");
  await navigate("/login");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  await switchTo("resident", "/resident/complaints/new");
  await fill("Complaint type", "APARTMENT");
  await fill("Required work type", "PLUMBING");
  await fill("Title", title);
  await fill("Description", "Water is leaking below the kitchen sink.");
  await click("Submit complaint");
  const residentPath = await waitFor(() => evaluate(`/^\\/resident\\/complaints\\/[a-f0-9-]{36}$/.test(location.pathname) && location.pathname`), "created complaint route");
  const id = residentPath.split("/").at(-1);
  const towerPath = `/tower-representative/complaints/${id}`;
  const workerPath = `/maintenance-worker/tasks/${id}`;

  await switchTo("tower", towerPath);
  await click("Start review");
  await click("Start review", '[role="dialog"]');
  await click("Assign worker");
  await selectRadio("workerId", "50000000-0000-4000-8000-000000000001");
  await click("Assign worker", '[role="dialog"]');
  await waitFor(() => evaluate(`!document.querySelector('[role="dialog"]') && document.body.innerText.includes("Kabir Das")`), "completed worker assignment");

  await switchTo("worker", workerPath);
  await waitText("Site inspection and estimate");
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Start work").disabled'), true);
  assert.equal(await evaluate('window.innerWidth'), 390);
  assert.ok(await evaluate('document.querySelector(".estimate-form").getBoundingClientRect().right <= window.innerWidth'));
  await fill("Inspection details", "          ");
  await fill("Proposed resolution", "Replace the drain trap and test.");
  await fill("Supporting notes", "The sink is accessible.");
  await fill("Estimated completion time (hours)", "2");
  await fill("Description", "Drain trap");
  await fill("Unit price (₹)", "42.35");
  await fill("Description", "Labour", 1);
  await fill("Unit price (₹)", "5.65", 1);
  await waitText("Estimated total ₹48.00");
  await click("Submit estimate");
  await waitText("Enter at least 10 characters");
  await fill("Inspection details", "The trap has a visible crack.");
  await click("Submit estimate", "body", 2);
  await waitText("Estimate awaiting tower verification");
  assert.equal(calls.filter(({ method, url }) => method === "POST" && url.endsWith("/estimate")).length, 1);
  assert.equal(await textVisible("Approve estimate"), false);

  await switchTo("tower", towerPath);
  await click("Return for revision");
  await fill("Revision feedback", "Include the replacement warranty.");
  await click("Confirm return", '[role="dialog"]');
  await waitText("Estimate returned for revision");

  await switchTo("worker", workerPath);
  await waitText("Include the replacement warranty.");
  await fill("Supporting notes", "Includes 12-month warranty.");
  await click("Submit revision");
  await waitText("Estimate awaiting tower verification");

  await switchTo("tower", towerPath);
  await click("Approve estimate");
  await click("Approve estimate", '[role="dialog"]');
  await waitText("Awaiting payment approval");

  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await switchTo("admin", adminPath);
  await click(`Review ${title}`);
  await waitText("Includes 12-month warranty.");
  assert.equal(await evaluate('window.innerWidth'), 1440);
  assert.ok(await evaluate('document.querySelector(".estimate-content").getBoundingClientRect().right <= window.innerWidth'));
  await click("Approve payment");
  await click("Approve payment", '[role="dialog"]');
  await click("Execute mock payment");
  await waitText("No money will be transferred.");
  await click("Cancel", '[role="dialog"]');
  assert.equal(calls.filter(({ url }) => url.endsWith("/mock-payment")).length, 0);
  await click("Execute mock payment");
  await click("Execute mock payment", '[role="dialog"]', 2);
  await waitText("Mock payment receipt");
  await waitText("Mock payment history");
  assert.equal(calls.filter(({ method, url }) => method === "POST" && url.endsWith("/mock-payment")).length, 1);

  await switchTo("resident", residentPath);
  await waitText("Mock payment completed");
  assert.equal(await textVisible("Includes 12-month warranty."), false);
  assert.equal(await textVisible("Mock payment receipt"), false);
  assert.equal(await textVisible("Approve payment"), false);
  await switchTo("worker", workerPath);
  await click("Start work");
  await waitText("Submit resolution proof");
  await fill("Problem found", "The drain trap was cracked.");
  await fill("Resolution summary", "Replaced the drain trap and verified it no longer leaks.");
  await evaluate(`(() => {
    const input = document.querySelector('.mw-form input[type="file"]');
    const files = new DataTransfer();
    const bytes = Uint8Array.from(atob(${JSON.stringify(png)}), char => char.charCodeAt(0));
    files.items.add(new File([bytes], "verified-repair.png", { type: "image/png" }));
    input.files = files.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await click("Upload image");
  await waitText("Proof image uploaded.");
  await click("Submit for verification");
  await waitText("Work submitted for authority verification.");

  await switchTo("tower", towerPath);
  await click("Verify resolution");
  await selectRadio("authorityRating", 5);
  await click("Verify resolution", '[role="dialog"]');
  await waitText("Verified by");

  await switchTo("resident", residentPath);
  for (const rating of ["speedRating", "qualityRating", "communicationRating"]) await selectRadio(rating, 5);
  await click("Submit review");
  await waitText("Thank you. Your review was submitted.");

  await switchTo("tower", towerPath);
  await click("Close complaint");
  await click("Close complaint", '[role="dialog"]');
  await waitText("Complaint closed.");
  await switchTo("resident", residentPath);
  await waitText("CLOSED");
  await waitText("Mock payment completed");
});
