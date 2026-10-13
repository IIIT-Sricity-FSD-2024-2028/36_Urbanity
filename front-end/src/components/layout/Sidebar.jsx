import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/useAuth.js";
import { getNavigationForRole } from "../../constants/navigation.js";

const ICON_PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  communities: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h2m2 0h2m-6 4h2m2 0h2m-6 7v-3h6v3" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  workforce: <><path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 3.6 12 2 17l5-1.6L15.4 7l2.3 2.3a4 4 0 0 0-3-5Z" /><path d="m14 14 6 6" /></>,
  complaints: <><path d="M6 3h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 3V5a2 2 0 0 1 2-2Z" /><path d="M8 8h8M8 12h5" /></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  hierarchy: <><path d="m12 2 8 4-8 4-8-4 8-4Z" /><path d="m4 10 8 4 8-4M4 14l8 4 8-4" /></>,
  billing: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  create: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  tasks: <><path d="M9 5h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1" /><path d="M9 3h6v4H9zM8 12h8M8 16h5" /></>,
  completed: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
};

function NavigationIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name] || ICON_PATHS.dashboard}
    </svg>
  );
}

export function Sidebar({ open = false, onClose }) {
  const { user, logout } = useAuth();
  const navigation = getNavigationForRole(user?.role);

  return (
    <aside
      className={`portal-sidebar${open ? " portal-sidebar--open" : ""}`}
      id="portal-navigation"
      aria-label="Primary navigation"
    >
      <div className="portal-sidebar__header">
        <NavLink className="portal-sidebar__brand" to={navigation.home} onClick={onClose}>
          URBANITY
          <span>{navigation.label.toUpperCase()}</span>
        </NavLink>
        <button className="portal-sidebar__close" type="button" onClick={onClose} aria-label="Close navigation">
          &times;
        </button>
      </div>

      <nav className="portal-sidebar__nav">
        {navigation.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            onClick={onClose}
            className={({ isActive }) =>
              `portal-sidebar__link${isActive ? " portal-sidebar__link--active" : ""}`
            }
          >
            <span className="portal-sidebar__link-icon"><NavigationIcon name={item.icon} /></span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="portal-sidebar__footer">
        <div className="portal-sidebar__user">
          <strong>{navigation.label}</strong>
          <span>{user?.email}</span>
        </div>
        <button className="portal-sidebar__logout" type="button" onClick={logout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
