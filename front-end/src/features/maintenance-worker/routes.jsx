import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES } from "../../constants/routes.js";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { TasksPage } from "./pages/TasksPage.jsx";
import { TaskDetailsPage } from "./pages/TaskDetailsPage.jsx";
import { CompletedPage } from "./pages/CompletedPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import "./maintenance-worker.css";

export function MaintenanceWorkerRoutes() {
  return <Routes>
    <Route index element={<DashboardPage />} />
    <Route path="tasks" element={<TasksPage />} />
    <Route path="tasks/:id" element={<TaskDetailsPage />} />
    <Route path="completed" element={<CompletedPage />} />
    <Route path="profile" element={<ProfilePage />} />
    <Route path="*" element={<Navigate to={ROUTES.MAINTENANCE_WORKER} replace />} />
  </Routes>;
}
