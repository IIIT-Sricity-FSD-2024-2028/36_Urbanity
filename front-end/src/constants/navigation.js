import { ROLES } from "./roles.js";
import { ROUTES } from "./routes.js";

function portalNavigation(label, home, items = [{ label: "Overview", to: home, icon: "dashboard" }], topbarLabel = label) {
  return Object.freeze({
    label,
    topbarLabel,
    home,
    items: Object.freeze(items.map((item) => Object.freeze(item))),
  });
}

export const NAVIGATION_BY_ROLE = Object.freeze({
  [ROLES.SUPER_ADMIN]: portalNavigation("Super Admin Portal", ROUTES.SUPER_ADMIN, [
    { label: "Platform Dashboard", to: ROUTES.SUPER_ADMIN, icon: "dashboard" },
    { label: "Communities", to: ROUTES.SUPER_ADMIN_COMMUNITIES, icon: "communities" },
    { label: "Platform Users", to: ROUTES.SUPER_ADMIN_USERS, icon: "users" },
    { label: "Complaints", to: ROUTES.SUPER_ADMIN_COMPLAINTS, icon: "complaints" },
    { label: "Reports", to: ROUTES.SUPER_ADMIN_REPORTS, icon: "reports" },
    { label: "Profile", to: ROUTES.SUPER_ADMIN_PROFILE, icon: "profile" },
  ], "Super Admin Service Portal"),
  [ROLES.COMMUNITY_ADMIN]: portalNavigation(
    "Community Admin Portal",
    ROUTES.COMMUNITY_ADMIN,
    [
      { label: "Dashboard", to: ROUTES.COMMUNITY_ADMIN, icon: "dashboard" },
      { label: "Complaints", to: ROUTES.COMMUNITY_ADMIN_COMPLAINTS, icon: "complaints" },
      { label: "Paid Services", to: ROUTES.COMMUNITY_ADMIN_SERVICES, icon: "workforce" },
      { label: "Hierarchy", to: ROUTES.COMMUNITY_ADMIN_HIERARCHY, icon: "hierarchy" },
      { label: "Rentals", to: ROUTES.COMMUNITY_ADMIN_RENTALS, icon: "billing" },
      { label: "Community Users", to: ROUTES.COMMUNITY_ADMIN_USERS, icon: "users" },
      { label: "Workforce", to: ROUTES.COMMUNITY_ADMIN_WORKFORCE, icon: "workforce" },
      { label: "Plan & Billing", to: ROUTES.COMMUNITY_ADMIN_SUBSCRIPTION, icon: "billing" },
      { label: "Reports", to: ROUTES.COMMUNITY_ADMIN_REPORTS, icon: "reports" },
      { label: "Amenities", to: ROUTES.COMMUNITY_ADMIN_AMENITIES, icon: "communities" },
      { label: "Amenity bookings", to: ROUTES.COMMUNITY_ADMIN_BOOKINGS, icon: "tasks" },
      { label: "Profile", to: ROUTES.COMMUNITY_ADMIN_PROFILE, icon: "profile" },
    ],
    "Community Admin Service Portal",
  ),
  [ROLES.TOWER_REPRESENTATIVE]: portalNavigation(
    "Tower Representative Portal",
    ROUTES.TOWER_REPRESENTATIVE,
    [
      { label: "Dashboard", to: ROUTES.TOWER_REPRESENTATIVE, icon: "dashboard" },
      { label: "Complaints", to: ROUTES.TOWER_REPRESENTATIVE_COMPLAINTS, icon: "complaints" },
      { label: "Paid Services", to: ROUTES.TOWER_REPRESENTATIVE_SERVICES, icon: "workforce" },
      { label: "Workforce", to: ROUTES.TOWER_REPRESENTATIVE_WORKFORCE, icon: "workforce" },
      { label: "Tower & Residents", to: ROUTES.TOWER_REPRESENTATIVE_RESIDENTS, icon: "communities" },
      { label: "Reports", to: ROUTES.TOWER_REPRESENTATIVE_REPORTS, icon: "reports" },
      { label: "Profile", to: ROUTES.TOWER_REPRESENTATIVE_PROFILE, icon: "profile" },
    ],
    "Tower Representative Service Portal",
  ),
  [ROLES.RESIDENT]: portalNavigation(
    "Resident Portal",
    ROUTES.RESIDENT,
    [
      { label: "Dashboard", to: ROUTES.RESIDENT, icon: "dashboard" },
      { label: "My complaints", to: ROUTES.RESIDENT_COMPLAINTS, icon: "complaints" },
      { label: "Paid Services", to: ROUTES.RESIDENT_SERVICES, icon: "workforce" },
      { label: "Create complaint", to: ROUTES.RESIDENT_NEW_COMPLAINT, icon: "create" },
      { label: "Rentals", to: ROUTES.RESIDENT_RENTALS, icon: "billing" },
      { label: "Amenities", to: ROUTES.RESIDENT_AMENITIES, icon: "communities" },
      { label: "Amenity bookings", to: ROUTES.RESIDENT_BOOKINGS, icon: "tasks" },
      { label: "Profile", to: ROUTES.RESIDENT_PROFILE, icon: "profile" },
    ],
    "Resident Service Portal",
  ),
  [ROLES.MAINTENANCE_WORKER]: portalNavigation(
    "Maintenance Worker Portal",
    ROUTES.MAINTENANCE_WORKER,
    [
      { label: "Dashboard", to: ROUTES.MAINTENANCE_WORKER, icon: "dashboard" },
      { label: "Assigned Tasks", to: ROUTES.MAINTENANCE_WORKER_TASKS, icon: "tasks" },
      { label: "Paid Services", to: ROUTES.MAINTENANCE_WORKER_SERVICES, icon: "workforce" },
      { label: "Completed Work", to: ROUTES.MAINTENANCE_WORKER_COMPLETED, icon: "completed" },
      { label: "Profile", to: ROUTES.MAINTENANCE_WORKER_PROFILE, icon: "profile" },
    ],
    "Maintenance Worker Service Portal",
  ),
});

const FALLBACK_NAVIGATION = Object.freeze({
  label: "Urbanity Portal",
  topbarLabel: "Urbanity Portal",
  home: ROUTES.HOME,
  items: Object.freeze([]),
});

export function getNavigationForRole(role) {
  return NAVIGATION_BY_ROLE[role] || FALLBACK_NAVIGATION;
}
