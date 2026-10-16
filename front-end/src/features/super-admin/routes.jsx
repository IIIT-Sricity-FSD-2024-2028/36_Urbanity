import { RegistrationsPage } from "./pages/RegistrationsPage.jsx";
import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES } from "../../constants/routes.js";
import { CommunitiesPage } from "./pages/CommunitiesPage.jsx";
import { ComplaintsPage } from "./pages/ComplaintsPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { ReportsPage } from "./pages/ReportsPage.jsx";
import { UsersPage } from "./pages/UsersPage.jsx";
import "./super-admin.css";

export function SuperAdminRoutes() {
  return <Routes>
    <Route path="registrations" element={<RegistrationsPage />} />
    <Route index element={<DashboardPage />} />
    <Route path="communities" element={<CommunitiesPage />} />
    <Route path="users" element={<UsersPage />} />
    <Route path="complaints" element={<ComplaintsPage />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="profile" element={<ProfilePage />} />
    <Route path="*" element={<Navigate to={ROUTES.SUPER_ADMIN} replace />} />
  </Routes>;
}
