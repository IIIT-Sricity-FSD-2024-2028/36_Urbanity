import { AmenitiesPage } from "../amenities/pages/AmenitiesPage.jsx";
import { BookingsPage } from "../amenities/pages/BookingsPage.jsx";
import { Route, Routes } from "react-router-dom";
import { EmptyState } from "../../components/ui/index.js";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { ComplaintsPage } from "./pages/ComplaintsPage.jsx";
import { CreateComplaintPage } from "./pages/CreateComplaintPage.jsx";
import { ComplaintDetailsPage } from "./pages/ComplaintDetailsPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import "./resident.css";
import { PaidServicesPage } from "../paid-services/pages/PaidServicesPage.jsx";

export function ResidentRoutes() {
  return <Routes><Route path="amenities" element={<AmenitiesPage />} /><Route path="amenity-bookings" element={<BookingsPage />} />
    <Route index element={<DashboardPage />} />
    <Route path="services" element={<PaidServicesPage />} />
    <Route path="complaints" element={<ComplaintsPage />} />
    <Route path="complaints/new" element={<CreateComplaintPage />} />
    <Route path="complaints/:id" element={<ComplaintDetailsPage />} />
    <Route path="profile" element={<ProfilePage />} />
    <Route path="*" element={<EmptyState title="Page not found" message="Choose a Resident page from the navigation." />} />
  </Routes>;
}
