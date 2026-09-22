import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute.jsx";
import { RoleRoute } from "../auth/RoleRoute.jsx";
import { Card, EmptyState } from "../components/ui/index.js";
import { PageHeader } from "../components/data-display/index.js";
import { ROLES } from "../constants/roles.js";
import { ROUTES } from "../constants/routes.js";
import { PortalLayout } from "../layouts/PortalLayout.jsx";
import { PublicLayout } from "../layouts/PublicLayout.jsx";
import { LoginPage } from "../features/authentication/pages/LoginPage.jsx";
import { CommunityAdminRoutes } from "../features/community-admin/routes.jsx";
import { LandingPage } from "../features/landing/pages/LandingPage.jsx";
import { SuperAdminRoutes } from "../features/super-admin/routes.jsx";

function PublicPlaceholder({ title, message }) {
  return (
    <main className="public-placeholder">
      <section className="ui-card public-placeholder__card">
        <p className="public-placeholder__brand">Urbanity</p>
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function PortalPlaceholder({ title }) {
  return (
    <>
      <PageHeader
        eyebrow="Portal workspace"
        title={title}
        description="This route is reserved for the upcoming actor-specific React migration."
      />
      <Card>
        <EmptyState
          title="Portal migration pending"
          message="The shared Urbanity shell is ready; actor functionality will be added in a later stage."
        />
      </Card>
    </>
  );
}

const actorRoutes = [
  {
    path: `${ROUTES.TOWER_REPRESENTATIVE}/*`,
    role: ROLES.TOWER_REPRESENTATIVE,
    title: "Tower Representative",
  },
  {
    path: `${ROUTES.RESIDENT}/*`,
    role: ROLES.RESIDENT,
    title: "Resident",
  },
  {
    path: `${ROUTES.MAINTENANCE_WORKER}/*`,
    role: ROLES.MAINTENANCE_WORKER,
    title: "Maintenance Worker",
  },
];

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      {
        path: ROUTES.HOME,
        element: <LandingPage />,
      },
      {
        path: ROUTES.LOGIN,
        element: <LoginPage />,
      },
      {
        path: ROUTES.UNAUTHORIZED,
        element: (
          <PublicPlaceholder
            title="Unauthorized"
            message="You do not have access to that route."
          />
        ),
      },
      {
        path: "*",
        element: (
          <PublicPlaceholder
            title="Not found"
            message="The requested route does not exist."
          />
        ),
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: `${ROUTES.SUPER_ADMIN}/*`,
        element: <RoleRoute allowedRoles={[ROLES.SUPER_ADMIN]}><PortalLayout><SuperAdminRoutes /></PortalLayout></RoleRoute>,
      },
      {
        path: `${ROUTES.COMMUNITY_ADMIN}/*`,
        element: <RoleRoute allowedRoles={[ROLES.COMMUNITY_ADMIN]}><PortalLayout><CommunityAdminRoutes /></PortalLayout></RoleRoute>,
      },
      ...actorRoutes.map(({ path, role, title }) => ({
        path,
        element: <RoleRoute allowedRoles={[role]}><PortalLayout><PortalPlaceholder title={`${title} Portal`} /></PortalLayout></RoleRoute>,
      })),
    ],
  },
]);
