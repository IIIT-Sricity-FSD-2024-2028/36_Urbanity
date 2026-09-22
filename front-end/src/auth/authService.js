import api from "../api/client.js";

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
  const request = currentUserRequest ?? api.get("/auth/me");
  currentUserRequest = request;

  try {
    return await request;
  } finally {
    if (currentUserRequest === request) {
      currentUserRequest = null;
    }
  }
}
