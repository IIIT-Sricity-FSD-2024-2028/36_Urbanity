(function attachUrbanityApi(global) {
  "use strict";

  const API_BASE_URL = "http://localhost:3000";
  const ACCESS_TOKEN_KEY = "accessToken";
  const CURRENT_USER_KEY = "currentUser";
  const LEGACY_SESSION_KEYS = ["urbanityRoleContext", "urbanityRole", "urbanityRoleLabel", "urbanityCurrentUser"];

  class ApiError extends Error {
    constructor(message, status, response) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.response = response;
    }
  }

  function getAccessToken() { return sessionStorage.getItem(ACCESS_TOKEN_KEY); }

  function getStoredUser() {
    const serializedUser = sessionStorage.getItem(CURRENT_USER_KEY);
    if (!serializedUser) return null;
    try { return JSON.parse(serializedUser); } catch (_error) {
      sessionStorage.removeItem(CURRENT_USER_KEY);
      return null;
    }
  }

  function saveSession(accessToken, user) {
    if (!accessToken || !user || !user.id || !user.email || !user.role) {
      throw new Error("The authentication response was incomplete.");
    }
    const safeUser = { id: user.id, email: user.email, role: user.role };
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
    return safeUser;
  }

  function clearSession() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(CURRENT_USER_KEY);
    LEGACY_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
  }

  function authenticationPagePath() {
    return window.location.pathname.includes("/Authentication/") ? "auth.html" : "../Authentication/auth.html";
  }

  function redirectToLogin() { window.location.assign(authenticationPagePath()); }
  function buildUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  }

  async function parseResponse(response, responseType) {
    if (responseType === "blob") return response.blob();
    if (responseType === "arrayBuffer") return response.arrayBuffer();
    if ((response.headers.get("content-type") || "").includes("application/json")) return response.json();
    const text = await response.text();
    return text || null;
  }

  function errorMessage(payload, status) {
    const message = payload?.error?.message || payload?.message;
    if (Array.isArray(message)) return message.join(", ");
    return message || `Request failed with status ${status}.`;
  }

  async function apiRequest(path, options = {}) {
    const { method = "GET", body, headers = {}, authenticated = true, redirectOnUnauthorized = true, responseType } = options;
    const requestHeaders = new Headers(headers);
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    let requestBody = body;
    if (body && !isFormData && typeof body === "object") {
      requestBody = JSON.stringify(body);
      if (!requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");
    }
    const accessToken = getAccessToken();
    if (authenticated && accessToken && !requestHeaders.has("Authorization")) {
      requestHeaders.set("Authorization", `Bearer ${accessToken}`);
    }
    let response;
    try {
      response = await fetch(buildUrl(path), { method, headers: requestHeaders, body: requestBody });
    } catch (_error) {
      throw new ApiError("Unable to reach the Urbanity service. Please try again.", 0, null);
    }
    const payload = await parseResponse(response, responseType);
    if (!response.ok) {
      if (response.status === 401 && authenticated) {
        clearSession();
        if (redirectOnUnauthorized) redirectToLogin();
      }
      throw new ApiError(errorMessage(payload, response.status), response.status, payload);
    }
    return payload;
  }

  async function getCurrentUser() {
    const user = (await apiRequest("/auth/me"))?.data;
    if (user?.id && user?.email && user?.role) {
      sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ id: user.id, email: user.email, role: user.role }));
    }
    return user;
  }

  function logout() { clearSession(); redirectToLogin(); }

  global.UrbanityApi = { API_BASE_URL, ApiError, apiRequest, clearSession, getAccessToken, getCurrentUser, getStoredUser, logout, saveSession };
})(window);
