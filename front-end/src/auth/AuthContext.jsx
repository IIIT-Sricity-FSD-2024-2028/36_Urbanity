import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearSession,
  getAccessToken,
  getSessionRevision,
  getStoredUser,
  saveSession,
  setUnauthorizedHandler,
} from "../api/client.js";
import {
  getCurrentUser,
  login as requestLogin,
} from "./authService.js";

export const AuthContext = createContext(undefined);

function getInitialSession() {
  const token = getAccessToken();

  return {
    token,
    user: token ? getStoredUser() : null,
    revision: getSessionRevision(),
    platformPaymentRequired: null,
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getInitialSession);
  const [loading, setLoading] = useState(true);

  const markSignedOut = useCallback(() => {
    setSession({ token: null, user: null, revision: getSessionRevision(), platformPaymentRequired: null });
    setLoading(false);
  }, []);

  const clearAuthentication = useCallback(() => {
    clearSession();
    markSignedOut();
  }, [markSignedOut]);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      clearAuthentication();
      return null;
    }

    const revision = getSessionRevision();
    const response = await getCurrentUser();
    if (revision !== getSessionRevision()) return null;
    const user = saveSession(token, response?.data);
    setSession({ token, user, revision: getSessionRevision(), platformPaymentRequired: response?.data?.platformPaymentRequired === true });
    return user;
  }, [clearAuthentication]);

  const login = useCallback(async (email, password) => {
    const revision = getSessionRevision();
    const response = await requestLogin(email, password);
    if (revision !== getSessionRevision()) throw new Error("This sign-in is no longer active.");
    const token = response?.data?.accessToken;
    const user = saveSession(token, response?.data?.user);

    setSession({ token, user, revision: getSessionRevision(), platformPaymentRequired: response?.data?.user?.platformPaymentRequired === true });
    return response;
  }, []);

  const logout = useCallback(() => {
    clearAuthentication();
  }, [clearAuthentication]);

  useEffect(() => {
    let active = true;

    const handleUnauthorized = () => {
      if (active) {
        markSignedOut();
      }
    };

    setUnauthorizedHandler(handleUnauthorized);

    async function restoreSession() {
      if (!getAccessToken()) {
        if (active) {
          clearAuthentication();
        }
        return;
      }

      try {
        await refreshUser();
      } catch {
        // The Axios interceptor clears an expired current session.
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, [clearAuthentication, markSignedOut, refreshUser]);

  const value = useMemo(
    () => ({
      user: session.user,
      token: session.token,
      sessionRevision: session.revision,
      platformPaymentRequired: session.platformPaymentRequired,
      authenticated: Boolean(session.token && session.user),
      loading,
      login,
      logout,
      refreshUser,
    }),
    [loading, login, logout, refreshUser, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
