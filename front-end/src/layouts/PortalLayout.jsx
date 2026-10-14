import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { Sidebar } from "../components/layout/Sidebar.jsx";
import { Topbar } from "../components/layout/Topbar.jsx";
import { getNavigationForRole } from "../constants/navigation.js";

export function PortalLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const navigation = getNavigationForRole(user?.role);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="portal-shell">
      <a className="skip-link" href="#portal-main-content">Skip to content</a>
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      {sidebarOpen && (
        <button
          className="portal-sidebar-overlay"
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="portal-shell__main">
        <Topbar
          title={navigation.topbarLabel}
          onMenuToggle={() => setSidebarOpen((current) => !current)}
          menuOpen={sidebarOpen}
        />
        <main className="portal-content" id="portal-main-content" tabIndex={-1}>{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
