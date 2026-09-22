import { ROLES } from "./roles.js";
import { ROUTES } from "./routes.js";

function portalNavigation(label, home, items = [{ label: "Overview", to: home }]) {
  return Object.freeze({
    label,
    home,
    items: Object.freeze(items.map((item) => Object.freeze(item))),
  });
}

export const NAVIGATION_BY_ROLE = Object.freeze({
  [ROLES.SUPER_ADMIN]: portalNavigation("Super Admin Portal", ROUTES.SUPER_ADMIN, [
    { label: "Dashboard", to: ROUTES.SUPER_ADMIN },
    { label: "Communities", to: ROUTES.SUPER_ADMIN_COMMUNITIES },
    { label: "Platform Users", to: ROUTES.SUPER_ADMIN_USERS },
    { label: "Workforce", to: ROUTES.SUPER_ADMIN_WORKFORCE },
    { label: "Complaints", to: ROUTES.SUPER_ADMIN_COMPLAINTS },
    { label: "Reports", to: ROUTES.SUPER_ADMIN_REPORTS },
    { label: "Profile", to: ROUTES.SUPER_ADMIN_PROFILE },
  ]),
  [ROLES.COMMUNITY_ADMIN]: portalNavigation(
    "Community Admin Portal",
    ROUTES.COMMUNITY_ADMIN,
  ),
  [ROLES.TOWER_REPRESENTATIVE]: portalNavigation(
    "Tower Representative Portal",
    ROUTES.TOWER_REPRESENTATIVE,
  ),
  [ROLES.RESIDENT]: portalNavigation("Resident Portal", ROUTES.RESIDENT, [
    { label: "Dashboard", to: ROUTES.RESIDENT },
    { label: "My complaints", to: ROUTES.RESIDENT_COMPLAINTS },
    { label: "Create complaint", to: ROUTES.RESIDENT_NEW_COMPLAINT },
    { label: "Profile", to: ROUTES.RESIDENT_PROFILE },
  ]),
  [ROLES.MAINTENANCE_WORKER]: portalNavigation(
    "Maintenance Worker Portal",
    ROUTES.MAINTENANCE_WORKER,
  ),
});

const FALLBACK_NAVIGATION = Object.freeze({
  label: "Urbanity Portal",
  home: ROUTES.HOME,
  items: Object.freeze([]),
});

export function getNavigationForRole(role) {
  return NAVIGATION_BY_ROLE[role] || FALLBACK_NAVIGATION;
}
