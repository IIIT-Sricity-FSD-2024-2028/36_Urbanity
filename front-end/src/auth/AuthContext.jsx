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
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getInitialSession);
  const [loading, setLoading] = useState(true);

  const clearAuthentication = useCallback(() => {
    clearSession();
    setSession({ token: null, user: null });
    setLoading(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      clearAuthentication();
      return null;
    }

    const response = await getCurrentUser();
    const user = saveSession(token, response?.data);
    setSession({ token, user });
    return user;
  }, [clearAuthentication]);

  const login = useCallback(async (email, password) => {
    const response = await requestLogin(email, password);
    const token = response?.data?.accessToken;
    const user = saveSession(token, response?.data?.user);

    setSession({ token, user });
    return response;
  }, []);

  const logout = useCallback(() => {
    clearAuthentication();
  }, [clearAuthentication]);

  useEffect(() => {
    let active = true;

    const handleUnauthorized = () => {
      if (active) {
        clearAuthentication();
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
      } catch (error) {
        if (active && error?.status === 401) {
          clearAuthentication();
        }
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
  }, [clearAuthentication, refreshUser]);

  const value = useMemo(
    () => ({
      user: session.user,
      token: session.token,
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
