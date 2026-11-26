import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ROUTES } from "../constants/routes.js";
import { useAuth } from "./useAuth.js";
import { Button, ErrorState } from "../components/ui/index.js";

export function ProtectedRoute({ children }) {
  const { authenticated, loading, platformPaymentRequired, refreshUser, logout } = useAuth();
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
  if (platformPaymentRequired === null) {
    return <main className="registration-page">
      <ErrorState message="Unable to check your account access." onRetry={() => refreshUser().catch(() => {})} />
      <Button variant="secondary" onClick={logout}>Log out</Button>
    </main>;
  }
  const paymentPath = ROUTES.PLATFORM_PAYMENT;
  if (platformPaymentRequired && location.pathname !== paymentPath && !location.pathname.startsWith(`${paymentPath}/`)) {
    return <Navigate to={paymentPath} replace />;
  }

  return children ?? <Outlet />;
}
