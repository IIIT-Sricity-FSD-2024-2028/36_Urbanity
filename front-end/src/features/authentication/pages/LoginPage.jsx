import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, LoadingState } from "../../../components/ui/index.js";
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
      <section className="login-hero" aria-label="Urbanity">
        <div className="login-hero__image" aria-hidden="true" />
        <div className="login-hero__content">
          <div className="login-hero__logo">
            <svg className="login-hero__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h1>Urbanity</h1>
          </div>
          <p>Community operations, made transparent.</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-panel__content">
          <header className="login-form__header">
            <h2>Sign in</h2>
            <p>Use your Urbanity account to continue.</p>
          </header>
          {errors.form && <div className="login-form__message" role="alert" aria-live="polite">{errors.form}</div>}
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-form__group">
              <label htmlFor="signinEmail">Email address</label>
              <input
                id="signinEmail"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={errors.email ? "true" : undefined}
                aria-describedby={errors.email ? "signinEmail-error" : undefined}
                required
              />
              {errors.email && <p className="login-form__field-error" id="signinEmail-error">{errors.email}</p>}
            </div>
            <div className="login-form__group">
              <label htmlFor="signinPassword">Password</label>
              <div className="login-form__password-field">
                <input
                  id="signinPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={errors.password ? "true" : undefined}
                  aria-describedby={errors.password ? "signinPassword-error" : undefined}
                  required
                />
                <button
                  className="login-form__password-toggle"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18M10.584 10.587A2 2 0 0 0 13.414 13.4M9.88 4.24A9.77 9.77 0 0 1 12 4c4.478 0 8.268 2.943 9.542 7a9.77 9.77 0 0 1-4.132 5.072M6.61 6.61A9.77 9.77 0 0 0 2.458 12C3.732 16.057 7.523 19 12 19c.847 0 1.67-.105 2.458-.301" />
                    </svg>
                  ) : (
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="login-form__field-error" id="signinPassword-error">{errors.password}</p>}
            </div>
            <Button className="login-form__submit" type="submit" fullWidth loading={submitting} loadingLabel="Signing in...">
              Sign in
            </Button>
          </form>
          <p className="login-form__footer">Accounts are created by Urbanity administrators. <Link to={ROUTES.REGISTER}>Register your community</Link>.</p>
        </div>
      </section>
    </main>
  );
}
