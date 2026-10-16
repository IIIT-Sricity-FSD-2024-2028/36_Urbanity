import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES } from "../../constants/routes.js";
import { ComplaintsPage } from "./pages/ComplaintsPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { HierarchyPage } from "./pages/HierarchyPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { ReportsPage } from "./pages/ReportsPage.jsx";
import { SubscriptionPage } from "./pages/SubscriptionPage.jsx";
import { UsersPage } from "./pages/UsersPage.jsx";
import { WorkforcePage } from "./pages/WorkforcePage.jsx";
import "./community-admin.css";
import { PaidServicesPage } from "../paid-services/pages/PaidServicesPage.jsx";

export function CommunityAdminRoutes() {
  return <Routes><Route index element={<DashboardPage />} /><Route path="services" element={<PaidServicesPage />} /><Route path="complaints" element={<ComplaintsPage />} /><Route path="hierarchy" element={<HierarchyPage />} /><Route path="users" element={<UsersPage />} /><Route path="workforce" element={<WorkforcePage />} /><Route path="subscription" element={<SubscriptionPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="profile" element={<ProfilePage />} /><Route path="*" element={<Navigate to={ROUTES.COMMUNITY_ADMIN} replace />} /></Routes>;
}
