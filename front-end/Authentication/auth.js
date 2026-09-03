const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BACKEND_ROLE_PORTALS = {
  SUPER_ADMIN: "../Super Admin/",
  COMMUNITY_ADMIN: "../Community Admin/",
  TOWER_REPRESENTATIVE: "../Tower Representative/index.html",
  RESIDENT: "../Resident/index.html",
  MAINTENANCE_WORKER: "../Maintenance Worker/index.html",
};

function showMessage(message, type = "error") {
  const node = document.getElementById("signinMessage");
  node.textContent = message;
  node.className = `auth-message auth-message-${type}`;
}

function clearMessage() {
  const node = document.getElementById("signinMessage");
  node.textContent = "";
  node.className = "auth-message hidden";
}

async function signIn(event) {
  event.preventDefault();
  clearMessage();
  const email = document.getElementById("signinEmail").value.trim().toLowerCase();
  const password = document.getElementById("signinPassword").value;
  if (!EMAIL_REGEX.test(email)) return showMessage("Enter a valid email address.");
  if (!password.trim()) return showMessage("Password is required.");
  if (!window.UrbanityApi) return showMessage("Authentication is unavailable. Please refresh and try again.");
  try {
    const response = await window.UrbanityApi.apiRequest("/auth/login", { method: "POST", body: { email, password }, authenticated: false, redirectOnUnauthorized: false });
    const accessToken = response?.data?.accessToken;
    const user = response?.data?.user;
    const portalPath = BACKEND_ROLE_PORTALS[user?.role];
    if (!accessToken || !portalPath) {
      window.UrbanityApi.clearSession();
      return showMessage("The sign-in response did not include a supported Urbanity account.");
    }
    window.UrbanityApi.saveSession(accessToken, user);
    showMessage("Signing you in...", "success");
    window.location.assign(portalPath);
  } catch (error) {
    window.UrbanityApi?.clearSession();
    showMessage(error?.message || "Unable to sign in. Please try again.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("signinForm").addEventListener("submit", signIn);
  ["signinEmail", "signinPassword"].forEach((id) => document.getElementById(id).addEventListener("input", clearMessage));
  document.querySelector("[data-password-toggle]").addEventListener("click", (event) => {
    const input = document.getElementById(event.currentTarget.dataset.passwordToggle);
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    event.currentTarget.querySelector("[data-password-visible-icon]").classList.toggle("hidden", hidden);
    event.currentTarget.querySelector("[data-password-hidden-icon]").classList.toggle("hidden", !hidden);
    event.currentTarget.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
    event.currentTarget.setAttribute("aria-pressed", String(hidden));
  });
});
