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

export function CommunityAdminRoutes() {
  return <Routes><Route index element={<DashboardPage />} /><Route path="complaints" element={<ComplaintsPage />} /><Route path="hierarchy" element={<HierarchyPage />} /><Route path="users" element={<UsersPage />} /><Route path="workforce" element={<WorkforcePage />} /><Route path="subscription" element={<SubscriptionPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="profile" element={<ProfilePage />} /><Route path="*" element={<Navigate to={ROUTES.COMMUNITY_ADMIN} replace />} /></Routes>;
}
