import api, { getSessionRevision } from "../api/client.js";

let currentUserRequest = null;

export function login(email, password) {
  return api.post(
    "/auth/login",
    { email, password },
    {
      authenticated: false,
      handleUnauthorized: false,
    },
  );
}

export async function getCurrentUser() {
  const revision = getSessionRevision();
  const pending = currentUserRequest?.revision === revision
    ? currentUserRequest
    : { revision, request: api.get("/auth/me") };
  currentUserRequest = pending;

  try {
    return await pending.request;
  } finally {
    if (currentUserRequest === pending) {
      currentUserRequest = null;
    }
  }
}
