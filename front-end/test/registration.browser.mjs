// Integration tests: Node's test runner + installed Chromium DevTools protocol.
// Uses an isolated Nest application, Vite server and disposable browser profile.
// Run: node --test test/registration.browser.mjs (Edge or CHROMIUM_PATH required).
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { build, preview } from "vite";

test(
  "public and Super Admin registration workflows in Chromium",
  { timeout: 300000 },
  async (t) => {
    const temporary = await mkdtemp(join(tmpdir(), "urbanity-onboarding-ui-"));
    const backendRoot = resolve("../back-end"),
      password = randomBytes(18).toString("base64url");
    const email = "browser-test-admin@example.test";
    let backend, browser, vite, socket;
    const pending = new Map();
    const loadedDocuments = new Set();
    let nextId = 0,
      sessionId;
    const bootstrap = `
    const {Test}=require('@nestjs/testing');
    const {AppModule}=require('./src/app.module');
    const {validationPipe}=require('./src/common/pipes/validation.pipe');
    const {LOG_DIRECTORY}=require('./src/common/logging/logging.constants');
    const {serviceToken}=require('./src/data/urbanity.resources');
    const {hashSync}=require('bcryptjs');
    const {RegistrationService}=require('./src/modules/registrations/registration.service');
    (async()=>{
      const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(LOG_DIRECTORY).useValue(process.env.TEST_LOG_DIRECTORY).compile();
      const app=module.createNestApplication({logger:false});app.useGlobalPipes(validationPipe);
      app.get(serviceToken('users')).create({name:'Browser Test Administrator',email:process.env.TEST_ADMIN_EMAIL,passwordHash:hashSync(process.env.TEST_ADMIN_PASSWORD,10),role:'SUPER_ADMIN',createdAt:new Date().toISOString()});
      const registration=app.get(RegistrationService);const record=registration.recordApprovalNotification.bind(registration);let failNotification=true;registration.recordApprovalNotification=(...args)=>{if(failNotification){failNotification=false;throw new Error('Test-only simulated notification failure')}return record(...args)};
      await app.listen(0,'127.0.0.1');console.log('URBANITY_PORT='+app.getHttpServer().address().port);
    })().catch(()=>{console.error('Isolated API startup failed');process.exit(1)});
  `;
    async function waitFor(check, label, timeout = 15000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        try {
          const value = await check();
          if (value) return value;
        } catch {}
        await delay(80);
      }
      throw new Error(`Timed out: ${label}`);
    }
    function command(method, params = {}, session = sessionId) {
      return new Promise((resolve, reject) => {
        const id = ++nextId,
          timeout = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`DevTools timeout: ${method}`));
          }, 15000);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject,
        });
        socket.send(
          JSON.stringify({
            id,
            method,
            params,
            ...(session ? { sessionId: session } : {}),
          }),
        );
      });
    }
    async function evaluate(expression) {
      const result = await command("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.text || "Page evaluation failed",
        );
      return result.result.value;
    }
    const content = (text) =>
      evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
    const waitText = async (text) => {
      try {
        return await waitFor(() => content(text), `visible text: ${text}`);
      } catch (error) {
        console.log(
          "Visible page:",
          await evaluate("document.body.innerText.slice(0, 2400)"),
        );
        await snapshot("failure.png");
        throw error;
      }
    };
    const navigate = async (path) => {
      const { loaderId } = await command("Page.navigate", {
        url: origin + path,
      });
      if (loaderId)
        await waitFor(
          () => loadedDocuments.has(loaderId),
          "new document loaded",
        );
      await waitFor(
        () => evaluate("document.readyState === 'complete'"),
        "page ready",
      );
    };
    const click = async (text) => {
      await waitFor(
        () =>
          evaluate(
            `[...document.querySelectorAll('button,a')].some(el=>(el.textContent.trim()===${JSON.stringify(text)} || el.getAttribute("aria-label")===${JSON.stringify(text)}) && !el.disabled)`,
          ),
        `enabled action: ${text}`,
      );
      await evaluate(
        `(()=>{const el=[...document.querySelectorAll('button,a')].find(el=>(el.textContent.trim()===${JSON.stringify(text)} || el.getAttribute("aria-label")===${JSON.stringify(text)}));if(!el||el.disabled)throw Error('Action unavailable');el.click();})()`,
      );
      await delay(60);
    };
    async function fill(label, value) {
      await evaluate(
        `(()=>{const label=[...document.querySelectorAll('label')].find(el=>el.textContent.trim().startsWith(${JSON.stringify(label)}));if(!label)throw Error('Label unavailable');const el=document.getElementById(label.htmlFor);const prototype=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
      );
      await delay(60);
    }
    async function login(address, secret) {
      await navigate("/login");
      await waitText("Sign in");
      await fill("Email address", address);
      await fill("Password", secret);
      await click("Sign in");
    }
    async function clearLogin() {
      await evaluate("sessionStorage.clear()");
      await navigate("/");
      await waitText("One place for");
    }
    const snapshot = async (name) => {
      const image = await command("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(join(temporary, name), Buffer.from(image.data, "base64"));
    };
    let origin, reference;
    try {
      backend = spawn(
        process.execPath,
        [
          "-r",
          "./node_modules/ts-node/register/transpile-only",
          "-e",
          bootstrap,
        ],
        {
          cwd: backendRoot,
          windowsHide: true,
          env: {
            ...process.env,
            TEST_ADMIN_EMAIL: email,
            TEST_ADMIN_PASSWORD: password,
            TEST_LOG_DIRECTORY: join(temporary, "logs"),
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      backend.stderr.on("data", (chunk) => { output += chunk.toString(); });
      backend.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });
      const apiPort = await waitFor(
        () => {
          if (backend.exitCode !== null) throw new Error(`Isolated API exited: ${output}`);
          return output.match(/URBANITY_PORT=(\d+)/)?.[1];
        },
        "isolated API startup",
        120000,
      );
      process.env.VITE_API_URL = "/api";
      const outputDir = join(temporary, "dist");
      await build({
        logLevel: "error",
        build: { outDir: outputDir, emptyOutDir: true },
      });
      const previewServer = await preview({
        build: { outDir: outputDir },
        preview: {
          port: 0,
          host: "127.0.0.1",
          proxy: {
            "/api": {
              target: `http://127.0.0.1:${apiPort}`,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ""),
            },
          },
        },
      });
      vite = {
        httpServer: previewServer.httpServer,
        close: () =>
          new Promise((resolve) => previewServer.httpServer.close(resolve)),
      };
      origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
      const profile = join(temporary, "browser");
      browser = spawn(
        process.env.CHROMIUM_PATH ||
          "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        [
          "--headless",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--disable-extensions",
          "--no-first-run",
          "--remote-debugging-port=0",
          `--user-data-dir=${profile}`,
          "about:blank",
        ],
        { windowsHide: true, stdio: "ignore" },
      );
      const devtools = await waitFor(
        async () =>
          (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(
            "\n",
          ),
        "browser startup",
      );
      socket = new WebSocket(
        `ws://127.0.0.1:${devtools[0]}${devtools[1].trim()}`,
      );
      await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = reject;
      });
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (
          message.method === "Page.lifecycleEvent" &&
          message.params.name === "DOMContentLoaded"
        )
          loadedDocuments.add(message.params.loaderId);
        const p = pending.get(message.id);
        if (p) {
          pending.delete(message.id);
          message.error
            ? p.reject(new Error(message.error.message))
            : p.resolve(message.result);
        }
      };
      const target = await command(
        "Target.createTarget",
        { url: "about:blank" },
        null,
      );
      ({ sessionId } = await command(
        "Target.attachToTarget",
        { targetId: target.targetId, flatten: true },
        null,
      ));
      await command("Page.enable");
      await command("Page.setLifecycleEventsEnabled", { enabled: true });
      await command("Runtime.enable");
      await command("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });

      await t.test(
        "public landing, register navigation and protected portal redirect",
        async () => {
          await navigate("/");
          await waitText("One place for");
          assert.equal(
            await evaluate(
              "!!document.querySelector('.landing-hero__background img')",
            ),
            true,
          );
          await snapshot("landing-restored-desktop.png");
          for (const width of [820, 390]) {
            await command("Emulation.setDeviceMetricsOverride", {
              width,
              height: 844,
              deviceScaleFactor: 1,
              mobile: false,
            });
            assert.equal(
              await evaluate(
                "document.documentElement.scrollWidth <= innerWidth + 1",
              ),
              true,
            );
          }
          await click("Toggle navigation");
          assert.equal(
            await evaluate(
              "document.querySelector('.landing-nav__menu').getAttribute('aria-expanded')",
            ),
            "true",
          );
          assert.equal(
            await evaluate(
              "document.querySelector('#landing-mobile-navigation a[href=\"/register\"]').textContent",
            ),
            "Register Your Community",
          );
          await snapshot("landing-restored-mobile.png");
          await click("Toggle navigation");
          await command("Emulation.setDeviceMetricsOverride", {
            width: 1280,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: false,
          });
          assert.equal(
            await evaluate(
              "document.querySelector('a[href=\"/register\"]').textContent",
            ),
            "Register Your Community",
          );
          await navigate("/super-admin/registrations");
          await waitText("Sign in");
          assert.equal(await evaluate("location.pathname"), "/login");
          await navigate("/register");
          await waitText("Representative");
        },
      );
      if (process.env.REGISTRATION_BROWSER_LANDING_ONLY === "1") return;
      await t.test(
        "Super Admin login, navigation, empty list and payment configuration",
        async () => {
          await login(email, password);
          await waitText("Super Admin dashboard");
          await click("Registrations");
          await waitText("Evaluation payment configuration");
          await waitText("No matching applications");
          await fill("Initial payment (%)", "20");
          await fill(
            "Evaluation payment notice",
            "Mock Payment - Evaluation Only. No real transfer or email delivery.",
          );
          await fill("Public registration", "true");
          await click("Save configuration");
          await waitText("configuration saved");
        },
      );
      await t.test(
        "multi-step validation, mobile layout, quote and successful submission",
        async () => {
          await clearLogin();
          await navigate("/register");
          await waitText("Representative");
          await command("Emulation.setDeviceMetricsOverride", {
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: true,
          });
          await click("Continue");
          assert.equal(await content("Full name"), true);
          await fill("Full name", "Browser Representative");
          await fill("Email", "browser-applicant@example.test");
          await fill("Phone", "-------");
          assert.equal(
            await evaluate(
              'document.querySelector("[name=phone]").checkValidity()',
            ),
            false,
          );
          await fill("Phone", "+91 (98765) 43210");
          assert.equal(
            await evaluate(
              'document.querySelector("[name=phone]").checkValidity()',
            ),
            true,
          );
          await evaluate(
            "document.querySelector('input[type=checkbox]').click()",
          );
          await click("Continue");
          await waitText("Street address");
          for (const [label, value] of [
            ["Community name", "Browser Community"],
            ["Street address", "100 Test Road"],
            ["City", "Tirupati"],
            ["State", "Andhra Pradesh"],
            ["Postal code", "517001"],
          ])
            await fill(label, value);
          await click("Continue");
          await waitText("Number of towers");
          await fill("Number of towers", "2");
          await fill("Approximate total floors", "4");
          await fill("Approximate total apartments", "20");
          await click("Review fee & application");
          await waitText("Initial payment due");
          assert.equal(
            await evaluate(
              "document.documentElement.scrollWidth <= innerWidth + 1",
            ),
            true,
          );
          await snapshot("registration-mobile.png");
          await click("Submit Registration Request");
          await waitText("Application received");
          reference = await evaluate("location.pathname.split('/').at(-1)");
          assert.match(reference, /^[a-f0-9-]{36}$/);
          assert.equal(await content("Outstanding balance"), true);
          assert.equal(await content("2,200"), true);
        },
      );
      if (!reference)
        throw new Error("Registration submission did not complete");
      await t.test(
        "mock initial payment, credited balance and private lookup errors",
        async () => {
          await click("Pay Initial Amount");
          await waitText("Confirm mock payment");
          await click("Confirm Mock Payment");
          await waitText("Mock payment successful");
          await waitText("mock / initial / verified");
          assert.equal(await content("1,760"), true);
          await navigate(
            `/register/${reference.replace(/^./, reference[0] === "a" ? "b" : "a")}`,
          );
          await waitText("original registration browser");
          await navigate(`/register/${reference}`);
          await waitText("Application received");
          await command("Emulation.setDeviceMetricsOverride", {
            width: 1280,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: false,
          });
        },
      );
      await t.test(
        "acceptance, notification failure feedback and safe retry",
        async () => {
          await login(email, password);
          await waitText("Super Admin dashboard");
          await click("Registrations");
          await waitText("Browser Community");
          await click("Review");
          await waitText("Community details");
          assert.equal(
            await evaluate(
              "[...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Mail Him')",
            ),
            false,
          );
          assert.equal(
            await evaluate(
              "document.querySelectorAll('a[href^=\"mailto:\"]').length",
            ),
            0,
          );
          await snapshot("registration-detail-desktop.png");
          await command("Emulation.setDeviceMetricsOverride", {
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: false,
          });
          assert.equal(
            await evaluate(
              "document.querySelector('.ui-modal').scrollWidth <= document.querySelector('.ui-modal').clientWidth + 1",
            ),
            true,
          );
          await snapshot("registration-detail-mobile.png");
          await command("Emulation.setDeviceMetricsOverride", {
            width: 1280,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: false,
          });
          await fill(
            "Review reason",
            "Representative authority independently verified",
          );
          await evaluate(
            "document.querySelector('.sa-registration-authority input').click()",
          );
          await click("Accept & Send Email");
          await waitText("Accept & Send Email?");
          await click("Confirm decision");
          await waitText(
            "Application accepted, but the simulated email could not be recorded.",
          );
          assert.equal(
            await content("Application accepted and email sent successfully."),
            false,
          );
          await click("Retry Accept & Send Email");
          await waitText("Retry simulated approval email?");
          await click("Confirm decision");
          await waitText("Application accepted and email sent successfully.");
          await waitText("active");
          await evaluate(
            "[...document.querySelectorAll('summary')].find(el=>el.textContent.startsWith('Application history')).click()",
          );
          await waitText("SIMULATED");
          await snapshot("registration-admin-review.png");
        },
      );
      await t.test(
        "default credentials and remaining mock payment",
        async () => {
          await navigate(`/register/${reference}`);
          await waitText("created with the default password");
          assert.equal(await content("Start secure password setup"), false);
          const adminSession = await evaluate(
            "sessionStorage.getItem('accessToken')",
          );
          const adminUser = await evaluate(
            "sessionStorage.getItem('currentUser')",
          );
          await clearLogin();
          await login("browser-applicant@example.test", "1234567890");
          await waitText("Community dashboard");
          await evaluate(
            `sessionStorage.setItem('accessToken', ${JSON.stringify(adminSession)}); sessionStorage.setItem('currentUser', ${JSON.stringify(adminUser)})`,
          );
          await navigate(`/register/${reference}`);
          await waitText("Pay Remaining Amount");
          await click("Pay Remaining Amount");
          await waitText("Confirm mock payment");
          await click("Confirm Mock Payment");
          await waitText("Mock payment successful");
          await waitText("mock / remaining / verified");
        },
      );
      await t.test(
        "Community Admin login without a separate activation step",
        async () => {
          await navigate("/super-admin/registrations");
          await waitText("Browser Community");
          await click("Review");
          await waitText("active");
          assert.equal(await content("Activate community"), false);
          await clearLogin();
          await login("browser-applicant@example.test", "1234567890");
          await waitText("Community dashboard");
          assert.equal(await evaluate("location.pathname"), "/community-admin");
          assert.equal(
            await evaluate(
              "[...document.querySelectorAll('a')].filter(a=>['Rentals','Paid Services','Amenities'].includes(a.textContent.trim())).length",
            ),
            3,
          );
        },
      );
      await t.test(
        "Community Admin changes the default password in Profile",
        async () => {
          await click("Profile");
          await waitText("Your community identity");
          await click("Edit profile");
          await waitText("New password");
          await fill("New password", password);
          await click("Save changes");
          await waitText("Profile updated.");
          await clearLogin();
          await login("browser-applicant@example.test", "1234567890");
          await waitText("Invalid credentials");
          await fill("Password", password);
          await click("Sign in");
          await waitText("Community dashboard");
        },
      );
      await t.test(
        "Super Admin rejection requires reason and confirmation",
        async () => {
          await clearLogin();
          await navigate("/register");
          await waitText("Representative");
          await fill("Full name", "Second Representative");
          await fill("Email", "second-applicant@example.test");
          await evaluate(
            "document.querySelector('input[type=checkbox]').click()",
          );
          await click("Continue");
          for (const [label, value] of [
            ["Community name", "Rejected Community"],
            ["Street address", "200 Test Road"],
            ["City", "Tirupati"],
            ["State", "Andhra Pradesh"],
            ["Postal code", "517001"],
          ])
            await fill(label, value);
          await click("Continue");
          await fill("Number of towers", "1");
          await fill("Approximate total floors", "1");
          await fill("Approximate total apartments", "10");
          await click("Review fee & application");
          await waitText("Initial payment due");
          await click("Submit Registration Request");
          await waitText("Application received");
          await login(email, password);
          await waitText("Super Admin dashboard");
          await click("Registrations");
          await waitText("Rejected Community");
          await fill("Search applications", "Rejected Community");
          await click("Review");
          await waitText("Community details");
          assert.equal(
            await evaluate(
              "[...document.querySelectorAll('button')].find(b=>b.textContent==='Reject application').disabled",
            ),
            true,
          );
          await fill(
            "Review reason",
            "Applicant authority could not be verified",
          );
          await click("Reject application");
          await waitText("Reject registration?");
          await click("Confirm decision");
          await waitText("rejected");
        },
      );
      console.log(`Browser screenshots: ${temporary}`);
    } finally {
      if (socket?.readyState === WebSocket.OPEN) {
        try {
          await command("Browser.close", {}, null);
        } catch {}
        socket.close();
      }
      for (const process of [browser, backend])
        if (process && process.exitCode === null) process.kill();
      await vite?.close();
      // Preserve screenshots as review artifacts. Remove only the disposable browser profile.
      const profile = resolve(temporary, "browser");
      if (
        profile.startsWith(resolve(temporary) + "\\") ||
        profile.startsWith(resolve(temporary) + "/")
      )
        await rm(profile, {
          recursive: true,
          force: true,
          maxRetries: 3,
        }).catch(() => {});
    }
  },
);
