import { ROLES } from "./roles.js";
import { ROUTES } from "./routes.js";

function portalNavigation(label, home) {
  return Object.freeze({
    label,
    home,
    items: Object.freeze([
      Object.freeze({ label: "Overview", to: home }),
    ]),
  });
}

export const NAVIGATION_BY_ROLE = Object.freeze({
  [ROLES.SUPER_ADMIN]: portalNavigation("Super Admin Portal", ROUTES.SUPER_ADMIN),
  [ROLES.COMMUNITY_ADMIN]: portalNavigation(
    "Community Admin Portal",
    ROUTES.COMMUNITY_ADMIN,
  ),
  [ROLES.TOWER_REPRESENTATIVE]: portalNavigation(
    "Tower Representative Portal",
    ROUTES.TOWER_REPRESENTATIVE,
  ),
  [ROLES.RESIDENT]: portalNavigation("Resident Portal", ROUTES.RESIDENT),
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
