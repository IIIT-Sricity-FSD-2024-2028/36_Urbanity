import axios from "axios";

export const API_BASE_URL = String(import.meta.env.VITE_API_URL || "").replace(
  /\/+$/,
  "",
);

export const ACCESS_TOKEN_KEY = "accessToken";
export const CURRENT_USER_KEY = "currentUser";

const LEGACY_SESSION_KEYS = [
  "urbanityRoleContext",
  "urbanityRole",
  "urbanityRoleLabel",
  "urbanityCurrentUser",
];

let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.response = response;
  }
}

function getSessionStorage() {
  return typeof window !== "undefined" ? window.sessionStorage : null;
}

export function getAccessToken() {
  return getSessionStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getStoredUser() {
  const storage = getSessionStorage();
  const serializedUser = storage?.getItem(CURRENT_USER_KEY);

  if (!serializedUser) return null;

  try {
    return JSON.parse(serializedUser);
  } catch {
    storage.removeItem(CURRENT_USER_KEY);
    return null;
  }
}

export function saveSession(accessToken, user) {
  if (!accessToken || !user?.id || !user.email || !user.role) {
    throw new Error("The authentication response was incomplete.");
  }

  const storage = getSessionStorage();
  if (!storage) {
    throw new Error("Session storage is unavailable.");
  }

  const safeUser = { id: user.id, email: user.email, role: user.role };
  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  storage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
  return safeUser;
}

export function clearSession() {
  const storage = getSessionStorage();
  if (!storage) return;

  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(CURRENT_USER_KEY);
  LEGACY_SESSION_KEYS.forEach((key) => storage.removeItem(key));
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null;
}

function isFormData(value) {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function removeContentType(headers) {
  if (!headers) return;

  if (typeof headers.delete === "function") {
    headers.delete("Content-Type");
    return;
  }

  delete headers["Content-Type"];
  delete headers["content-type"];
}

function errorMessage(payload, status) {
  const message = payload?.error?.message || payload?.message;
  if (Array.isArray(message)) return message.join(", ");
  return message || `Request failed with status ${status}.`;
}

function normalizeError(error) {
  if (error instanceof ApiError) return error;

  if (!axios.isAxiosError(error)) {
    return new ApiError(error?.message || "An unexpected API error occurred.", 0, null);
  }

  if (!error.response) {
    return new ApiError(
      "Unable to reach the Urbanity service. Please try again.",
      0,
      null,
    );
  }

  const { status, data } = error.response;
  return new ApiError(errorMessage(data, status), status, data);
}

export const api = axios.create({
  baseURL: API_BASE_URL || undefined,
});

api.interceptors.request.use((config) => {
  if (config.responseType === "arrayBuffer") {
    config.responseType = "arraybuffer";
  }

  if (isFormData(config.data)) {
    removeContentType(config.headers);
  }

  if (config.authenticated !== false) {
    const accessToken = getAccessToken();
    const hasAuthorization =
      typeof config.headers?.has === "function"
        ? config.headers.has("Authorization")
        : Boolean(
            config.headers?.Authorization || config.headers?.authorization,
          );

    if (accessToken && !hasAuthorization) {
      if (typeof config.headers?.set === "function") {
        config.headers.set("Authorization", `Bearer ${accessToken}`);
      } else {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${accessToken}`,
        };
      }
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const normalizedError = normalizeError(error);
    const config = error.config || {};

    if (normalizedError.status === 401 && config.authenticated !== false) {
      clearSession();

      const shouldHandleUnauthorized =
        config.handleUnauthorized !== false &&
        config.redirectOnUnauthorized !== false;

      if (shouldHandleUnauthorized) {
        unauthorizedHandler?.(normalizedError);
      }
    }

    return Promise.reject(normalizedError);
  },
);

export default api;
