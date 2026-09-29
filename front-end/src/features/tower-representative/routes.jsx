import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES } from "../../constants/routes.js";
import { ComplaintDetailsPage } from "./pages/ComplaintDetailsPage.jsx";
import { ComplaintsPage } from "./pages/ComplaintsPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { ReportsPage } from "./pages/ReportsPage.jsx";
import { ResidentsPage } from "./pages/ResidentsPage.jsx";
import { WorkforcePage } from "./pages/WorkforcePage.jsx";
import "./tower-representative.css";

export function TowerRepresentativeRoutes() {
  return <Routes>
    <Route index element={<DashboardPage />} />
    <Route path="complaints" element={<ComplaintsPage />} />
    <Route path="complaints/:complaintId" element={<ComplaintDetailsPage />} />
    <Route path="workforce" element={<WorkforcePage />} />
    <Route path="residents" element={<ResidentsPage />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="profile" element={<ProfilePage />} />
    <Route path="*" element={<Navigate to={ROUTES.TOWER_REPRESENTATIVE} replace />} />
  </Routes>;
}
