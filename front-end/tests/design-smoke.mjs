// Render checks for the shared redesign. Browser interactions need separate QA.
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const moduleOf = (path) => server.ssrLoadModule(`/src/${path}`);
  const { AuthContext } = await moduleOf("auth/AuthContext.jsx");
  const { ToastProvider } = await moduleOf("components/ui/ToastProvider.jsx");
  const { PortalLayout } = await moduleOf("layouts/PortalLayout.jsx");
  const render = (element, role = "RESIDENT", path = "/") => renderToStaticMarkup(
    React.createElement(MemoryRouter, { initialEntries: [path] },
      React.createElement(AuthContext.Provider, { value: {
        user: { id: "test-account", email: "resident@example.test", role },
        authenticated: false, loading: false, logout() {},
      } }, React.createElement(ToastProvider, {}, element))),
  );
  const actorCases = [
    ["super-admin", "SuperAdminRoutes", "SUPER_ADMIN", ["/", "/communities", "/users", "/complaints", "/reports", "/profile"]],
    ["community-admin", "CommunityAdminRoutes", "COMMUNITY_ADMIN", ["/", "/hierarchy", "/users", "/workforce", "/complaints", "/subscription", "/reports", "/profile"]],
    ["tower-representative", "TowerRepresentativeRoutes", "TOWER_REPRESENTATIVE", ["/", "/complaints", "/complaints/test", "/workforce", "/residents", "/reports", "/profile"]],
    ["resident", "ResidentRoutes", "RESIDENT", ["/", "/complaints", "/complaints/new", "/complaints/test", "/profile"]],
    ["maintenance-worker", "MaintenanceWorkerRoutes", "MAINTENANCE_WORKER", ["/", "/tasks", "/tasks/test", "/completed", "/profile"]],
  ];
  let pages = 0;
  for (const [feature, exportName, role, paths] of actorCases) {
    const routes = (await moduleOf(`features/${feature}/routes.jsx`))[exportName];
    for (const path of paths) {
      const html = render(React.createElement(routes), role, path);
      assert(html.length > 0, `${feature}${path} did not render`);
      assert(!html.includes("Page not found"), `${feature}${path} matched a fallback`);
      pages++;
    }
    const html = render(React.createElement(PortalLayout, {}, "Workspace"), role, `/${feature}`);
    assert(html.includes('href="#portal-main-content"'));
    assert(html.includes('id="portal-main-content"'));
    assert.equal((html.match(/portal-sidebar__link--active/g) || []).length, 1);
  }
  // Detail pages retain their parent navigation; create has its own destination.
  for (const path of ["/resident/complaints/test", "/resident/complaints/new", "/maintenance-worker/tasks/test"]) {
    const html = render(React.createElement(PortalLayout, {}, "Workspace"), path.startsWith("/resident") ? "RESIDENT" : "MAINTENANCE_WORKER", path);
    assert.equal((html.match(/portal-sidebar__link--active/g) || []).length, 1, path);
  }
  const { LandingPage } = await moduleOf("features/landing/pages/LandingPage.jsx");
  const landing = render(React.createElement(LandingPage));
  assert(!landing.includes('href="#"'));
  assert(!landing.includes("50K+") && !landing.includes("Real-time Updates"));
  assert(landing.includes('id="public-main-content"'));
  const { LoginPage } = await moduleOf("features/authentication/pages/LoginPage.jsx");
  const login = render(React.createElement(LoginPage));
  assert(/autocomplete="email"/i.test(login) && /autocomplete="current-password"/i.test(login));
  assert(login.includes("Show password") && login.includes("Back to Urbanity"));
  const { TaskTable } = await moduleOf("features/maintenance-worker/components/TaskTable.jsx");
  const tasks = render(React.createElement(TaskTable, { tasks: [{
    id: "test-task", title: "<script>unsafe</script>", status: "PENDING_VERIFICATION",
    requiredWorkType: "PLUMBING", location: { apartmentNumber: "A-101" },
  }] }));
  assert(tasks.includes("Awaiting verification") && tasks.includes("A-101"));
  assert(tasks.includes("&lt;script&gt;") && !tasks.includes("<script>unsafe</script>"));
  assert(tasks.includes('href="/maintenance-worker/tasks/test-task"'));
  assert(render(React.createElement(TaskTable, { tasks: [] })).includes("No tasks found"));
  console.log(`Passed: ${pages} actor routes, five portal shells, nested navigation, landing links, login controls, and worker task rendering.`);
} finally {
  await server.close();
}
