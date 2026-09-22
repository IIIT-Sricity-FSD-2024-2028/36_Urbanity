import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/useAuth.js";
import { getNavigationForRole } from "../../constants/navigation.js";

function OverviewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" stroke="currentColor" />
      <rect x="14" y="3" width="7" height="7" stroke="currentColor" />
      <rect x="3" y="14" width="7" height="7" stroke="currentColor" />
      <rect x="14" y="14" width="7" height="7" stroke="currentColor" />
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
            <OverviewIcon />
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
