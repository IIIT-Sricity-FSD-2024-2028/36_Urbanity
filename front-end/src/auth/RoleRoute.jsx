import { Navigate, useLocation } from "react-router-dom";
import { ROUTES } from "../constants/routes.js";
import { useAuth } from "./useAuth.js";
import { ProtectedRoute } from "./ProtectedRoute.jsx";

export function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();
  const location = useLocation();
  const hasAllowedRole =
    Array.isArray(allowedRoles) && allowedRoles.includes(user?.role);

  return (
    <ProtectedRoute>
      {hasAllowedRole ? (
        children
      ) : (
        <Navigate
          to={ROUTES.UNAUTHORIZED}
          replace
          state={{ from: location.pathname }}
        />
      )}
    </ProtectedRoute>
  );
}
