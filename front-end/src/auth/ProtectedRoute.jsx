import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ROUTES } from "../constants/routes.js";
import { useAuth } from "./useAuth.js";

export function ProtectedRoute({ children }) {
  const { authenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p role="status">Checking authentication...</p>;
  }

  if (!authenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children ?? <Outlet />;
}
