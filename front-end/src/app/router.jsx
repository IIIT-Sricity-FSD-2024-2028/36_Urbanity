import { RegistrationPage } from "../features/registration/pages/RegistrationPage.jsx";
import { RegistrationStatusPage } from "../features/registration/pages/RegistrationStatusPage.jsx";
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute.jsx";
import { RoleRoute } from "../auth/RoleRoute.jsx";
import { ROLES } from "../constants/roles.js";
import { ROUTES } from "../constants/routes.js";
import { PortalLayout } from "../layouts/PortalLayout.jsx";
import { PublicLayout } from "../layouts/PublicLayout.jsx";
import { LoginPage } from "../features/authentication/pages/LoginPage.jsx";
import { CommunityAdminRoutes } from "../features/community-admin/routes.jsx";
import { LandingPage } from "../features/landing/pages/LandingPage.jsx";
import { SuperAdminRoutes } from "../features/super-admin/routes.jsx";
import { MaintenanceWorkerRoutes } from "../features/maintenance-worker/routes.jsx";
import { TowerRepresentativeRoutes } from "../features/tower-representative/routes.jsx";
import { ResidentRoutes } from "../features/resident/routes.jsx";

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

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: ROUTES.REGISTER, element: <RegistrationPage /> },
      { path: `${ROUTES.REGISTER}/:reference`, element: <RegistrationStatusPage /> },
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
      {
        path: `${ROUTES.TOWER_REPRESENTATIVE}/*`,
        element: <RoleRoute allowedRoles={[ROLES.TOWER_REPRESENTATIVE]}><PortalLayout><TowerRepresentativeRoutes /></PortalLayout></RoleRoute>,
      },
      {
        path: `${ROUTES.MAINTENANCE_WORKER}/*`,
        element: <RoleRoute allowedRoles={[ROLES.MAINTENANCE_WORKER]}><PortalLayout><MaintenanceWorkerRoutes /></PortalLayout></RoleRoute>,
      },
      {
        path: `${ROUTES.RESIDENT}/*`,
        element: <RoleRoute allowedRoles={[ROLES.RESIDENT]}><PortalLayout><ResidentRoutes /></PortalLayout></RoleRoute>,
      },
    ],
  },
]);
