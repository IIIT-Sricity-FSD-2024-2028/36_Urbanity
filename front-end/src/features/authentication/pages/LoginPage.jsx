import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Input, LoadingState } from "../../../components/ui/index.js";
import { NAVIGATION_BY_ROLE } from "../../../constants/navigation.js";
import { ROUTES } from "../../../constants/routes.js";
import "../authentication.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function homeForRole(role) {
  return NAVIGATION_BY_ROLE[role]?.home || null;
}

export function LoginPage() {
  const { authenticated, loading, login, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingState message="Restoring your session..." />;

  if (authenticated) {
    return <Navigate to={homeForRole(user?.role) || ROUTES.UNAUTHORIZED} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors = {};

    if (!normalizedEmail) nextErrors.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(normalizedEmail)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Password is required.";

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const response = await login(normalizedEmail, password);
      const role = response?.data?.user?.role;
      const roleHome = homeForRole(role);
      if (!roleHome) {
        logout();
        setErrors({ form: "This account does not have access to an active Urbanity portal." });
        return;
      }

      const requestedPath = location.state?.from;
      const destination = typeof requestedPath === "string" &&
        (requestedPath === roleHome || requestedPath.startsWith(`${roleHome}/`))
        ? requestedPath
        : roleHome;
      navigate(destination, { replace: true });
    } catch (error) {
      setErrors({ form: error?.message || "Unable to sign in. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-page__story" aria-label="Urbanity introduction">
        <p className="login-page__brand">Urbanity</p>
        <div>
          <p className="login-page__eyebrow">Apartment operations, connected</p>
          <h1>One workspace for every community.</h1>
          <p>Manage people, maintenance, and resident concerns with clear ownership at every level.</p>
        </div>
      </section>
      <section className="login-page__panel">
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div>
            <p className="login-form__eyebrow">Welcome back</p>
            <h2>Sign in to Urbanity</h2>
            <p>Use your registered account to open your assigned portal.</p>
          </div>
          {errors.form && <div className="login-form__error" role="alert">{errors.form}</div>}
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            required
          />
          <div className="login-form__password">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
              required
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>
          <Button type="submit" fullWidth loading={submitting} loadingLabel="Signing in...">
            Sign in
          </Button>
        </form>
      </section>
    </main>
  );
}
