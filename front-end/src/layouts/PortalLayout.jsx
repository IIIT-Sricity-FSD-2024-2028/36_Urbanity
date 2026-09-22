import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { Sidebar } from "../components/layout/Sidebar.jsx";
import { Topbar } from "../components/layout/Topbar.jsx";
import { getNavigationForRole } from "../constants/navigation.js";

export function PortalLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigation = getNavigationForRole(user?.role);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="portal-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
          title={navigation.label}
          onMenuToggle={() => setSidebarOpen((current) => !current)}
        />
        <main className="portal-content">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
