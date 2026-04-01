let currentRole = null;

const ROLE_CONFIG = {
  citizen: {
    storageRole: "citizen",
    label: "Citizen",
    portalPath: "../Citizen/index.html",
    scope: "citizen",
    permissions: {
      complaints: ["create", "read", "update"],
      profile: ["read", "update"],
    },
  },
  officer: {
    storageRole: "department_officer",
    label: "Department Officer",
    portalPath: "../Dept Officer/index.html",
    scope: "department",
    permissions: {
      complaints: ["read", "update"],
      profile: ["read", "update"],
    },
  },
  worker: {
    storageRole: "field_worker",
    label: "Field Worker",
    portalPath: "../FieldWorker/index.html",
    scope: "department",
    permissions: {
      assignments: ["read", "update"],
      profile: ["read", "update"],
    },
  },
  head: {
    storageRole: "domain_admin_dept_head",
    label: "Department Head",
    portalPath: "../Dept Head/index.html",
    scope: "department",
    permissions: {
      dashboard: ["read"],
      complaints: ["create", "read", "update"],
      "escalated-issues": ["create", "read", "update"],
      "department-officers": ["create", "read", "update"],
      "field-workers": ["create", "read", "update"],
      profile: ["read", "update"],
    },
  },
  admin: {
    storageRole: "super_user_admin",
    label: "Admin",
    portalPath: "../Admin/index.html",
    scope: "system",
    permissions: {
      "*": ["create", "read", "update", "delete"],
    },
  },
};

const ROLE_TO_USER_ROLE = {
  citizen: "Citizen",
  officer: "Department Officer",
  head: "Department Head",
  worker: "Field Worker",
  admin: "Admin",
};

const FALLBACK_CREDENTIALS = {
  citizen: { email: "anita.rao@urbanity.gov", password: "anita123" },
  officer: { email: "priya.sharma@urbanity.gov", password: "priya123" },
  head: { email: "amit.kumar@urbanity.gov", password: "amit123" },
  worker: { email: "ravi.verma@urbanity.gov", password: "ravi123" },
  admin: { email: "arjun.mehta@urbanity.gov", password: "arjun123" },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+91[-\s]?)?[6-9]\d{9}$/;

function validateCredentials(roleKey, email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const expectedRoleName = ROLE_TO_USER_ROLE[roleKey];

  if (window.MockDataAPI) {
    const users = window.MockDataAPI.list("users");
    const matchedUser = users.find((user) => {
      return (
        String(user.email || "").toLowerCase() === normalizedEmail &&
        String(user.password || "") === password &&
        String(user.role || "") === expectedRoleName
      );
    });

    if (matchedUser) {
      return matchedUser;
    }
  }

  const fallback = FALLBACK_CREDENTIALS[roleKey];
  if (
    fallback &&
    fallback.email.toLowerCase() === normalizedEmail &&
    fallback.password === password
  ) {
    return {
      id: `${roleKey}-fallback`,
      name: fallback.email.split("@")[0],
      email: fallback.email,
      role: expectedRoleName,
    };
  }

  return null;
}

function showSignup() {
  clearSigninMessage();
  hideAll();
  document.getElementById("signupForm").classList.remove("hidden");
}

function showSignInRoles() {
  clearSigninMessage();
  hideAll();
  document.getElementById("signinRoles").classList.remove("hidden");
}

function showSignInForm() {
  clearSigninMessage();
  hideAll();
  document.getElementById("signinForm").classList.remove("hidden");
}

function showForgotPassword() {
  clearSigninMessage();
  clearForgotPasswordMessage();
  hideAll();
  document.getElementById("forgotPasswordForm").classList.remove("hidden");
}

function selectRole(role) {
  currentRole = role;
  showSignInForm();
}

function hideAll() {
  const forms = [
    "signupForm",
    "signinRoles",
    "signinForm",
    "forgotPasswordForm",
    "forgotPasswordSuccess",
  ];
  forms.forEach((id) => {
    document.getElementById(id).classList.add("hidden");
  });
}

function showSigninMessage(text, type = "error") {
  const messageNode = document.getElementById("signinMessage");
  if (!messageNode) {
    return;
  }

  messageNode.textContent = text;
  messageNode.classList.remove("hidden", "auth-message-error", "auth-message-success");
  messageNode.classList.add(type === "success" ? "auth-message-success" : "auth-message-error");
}

function clearSigninMessage() {
  const messageNode = document.getElementById("signinMessage");
  if (!messageNode) {
    return;
  }

  messageNode.textContent = "";
  messageNode.classList.add("hidden");
  messageNode.classList.remove("auth-message-error", "auth-message-success");
}

function showSignupMessage(text, type = "error") {
  const messageNode = document.getElementById("signupMessage");
  if (!messageNode) {
    return;
  }

  messageNode.textContent = text;
  messageNode.classList.remove("hidden", "auth-message-error", "auth-message-success");
  messageNode.classList.add(type === "success" ? "auth-message-success" : "auth-message-error");
}

function clearSignupMessage() {
  const messageNode = document.getElementById("signupMessage");
  if (!messageNode) {
    return;
  }

  messageNode.textContent = "";
  messageNode.classList.add("hidden");
  messageNode.classList.remove("auth-message-error", "auth-message-success");
}

function getForgotPasswordMessageNode() {
  const formContainer = document.getElementById("forgotPasswordForm");
  if (!formContainer) {
    return null;
  }

  let node = document.getElementById("forgotPasswordMessage");
  if (node) {
    return node;
  }

  node = document.createElement("div");
  node.id = "forgotPasswordMessage";
  node.className = "auth-message hidden";
  node.setAttribute("role", "alert");
  node.setAttribute("aria-live", "polite");

  const backButton = formContainer.querySelector(".back-button");
  if (backButton) {
    backButton.insertAdjacentElement("afterend", node);
  } else {
    formContainer.insertBefore(node, formContainer.firstChild);
  }

  return node;
}

function showForgotPasswordMessage(text, type = "error") {
  const messageNode = getForgotPasswordMessageNode();
  if (!messageNode) {
    return;
  }

  messageNode.textContent = text;
  messageNode.classList.remove("hidden", "auth-message-error", "auth-message-success");
  messageNode.classList.add(type === "success" ? "auth-message-success" : "auth-message-error");
}

function clearForgotPasswordMessage() {
  const messageNode = document.getElementById("forgotPasswordMessage");
  if (!messageNode) {
    return;
  }

  messageNode.textContent = "";
  messageNode.classList.add("hidden");
  messageNode.classList.remove("auth-message-error", "auth-message-success");
}

function handleSignup(event) {
  event.preventDefault();
  clearSignupMessage();

  const fullName = document.getElementById("signupName")?.value?.trim() || "";
  const email = document.getElementById("signupEmail")?.value?.trim().toLowerCase() || "";
  const phone = document.getElementById("signupPhone")?.value?.trim() || "";
  const password = document.getElementById("signupPassword")?.value || "";
  const confirmPassword = document.getElementById("signupConfirm")?.value || "";

  // Validation
  if (!fullName || !email || !phone || !password || !confirmPassword) {
    showSignupMessage("Please fill in all fields.");
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    showSignupMessage("Please enter a valid email address.");
    return;
  }

  if (!PHONE_REGEX.test(phone)) {
    showSignupMessage("Enter a valid phone number.");
    return;
  }

  if (password.length < 6) {
    showSignupMessage("Password must be at least 6 characters.");
    return;
  }

  if (password !== confirmPassword) {
    showSignupMessage("Passwords do not match.");
    return;
  }

  // Check if email already exists
  if (window.MockDataAPI) {
    const existingUsers = window.MockDataAPI.list("users");
    const emailExists = existingUsers.some((user) => user.email.toLowerCase() === email);
    if (emailExists) {
      showSignupMessage("Email already registered. Please use a different email or sign in.");
      return;
    }
  }

  // Create new user with role Citizen
  const newUser = {
    id: "citizen-" + Date.now(),
    name: fullName,
    email: email,
    phone: phone,
    password: password,
    role: "Citizen",
  };

  if (window.MockDataAPI) {
    window.MockDataAPI.add("users", newUser);
  }

  showSignupMessage("Account created successfully! Redirecting to sign in...", "success");

  // Redirect to sign-in after a short delay
  setTimeout(() => {
    currentRole = "citizen";
    showSignInForm();
  }, 1500);
}

function handleSignin(event) {
  event.preventDefault();
  clearSigninMessage();

  const selectedRole = ROLE_CONFIG[currentRole];
  if (!selectedRole) {
    showSigninMessage("Please select a role before signing in.");
    showSignInRoles();
    return;
  }

  const email = document.getElementById("signinEmail")?.value || "";
  const password = document.getElementById("signinPassword")?.value || "";

  if (!EMAIL_REGEX.test(email.trim())) {
    showSigninMessage("Please enter a valid email address.");
    return;
  }

  if (!password.trim()) {
    showSigninMessage("Password is required.");
    return;
  }

  const matchedUser = validateCredentials(currentRole, email, password);
  if (!matchedUser) {
    showSigninMessage("Invalid credentials. Check your email, password, and selected role.");
    return;
  }

  showSigninMessage("Signing you in...", "success");

  const roleContext = {
    role: selectedRole.storageRole,
    label: selectedRole.label,
    scope: selectedRole.scope,
    permissions: selectedRole.permissions,
    signedInAt: new Date().toISOString(),
  };

  sessionStorage.setItem("urbanityRoleContext", JSON.stringify(roleContext));
  sessionStorage.setItem("urbanityRole", selectedRole.storageRole);
  sessionStorage.setItem("urbanityRoleLabel", selectedRole.label);
  sessionStorage.setItem(
    "urbanityCurrentUser",
    JSON.stringify({
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
    }),
  );

  window.location.href = selectedRole.portalPath;
}

function handleForgotPassword(event) {
  event.preventDefault();
  clearForgotPasswordMessage();
  const email = (document.getElementById("resetEmail").value || "").trim();

  if (!EMAIL_REGEX.test(email)) {
    showForgotPasswordMessage("Please enter a valid email address.");
    return;
  }

  document.getElementById("emailDisplay").textContent = email;
  hideAll();
  document.getElementById("forgotPasswordSuccess").classList.remove("hidden");
}

function setupPasswordVisibilityToggles() {
  const toggles = document.querySelectorAll("[data-password-toggle]");

  toggles.forEach((toggleButton) => {
    toggleButton.addEventListener("click", () => {
      const inputId = toggleButton.getAttribute("data-password-toggle");
      const passwordInput = document.getElementById(inputId);
      const eyeIcon = toggleButton.querySelector(".icon-eye");
      const eyeOffIcon = toggleButton.querySelector(".icon-eye-off");

      if (!passwordInput) {
        return;
      }

      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";

      if (eyeIcon && eyeOffIcon) {
        eyeIcon.classList.toggle("hidden", isHidden);
        eyeOffIcon.classList.toggle("hidden", !isHidden);
      }

      toggleButton.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      toggleButton.setAttribute("aria-pressed", String(isHidden));
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const signinEmail = document.getElementById("signinEmail");
  const signinPassword = document.getElementById("signinPassword");
  const resetEmail = document.getElementById("resetEmail");
  const signupInputs = [
    "signupName",
    "signupEmail",
    "signupPhone",
    "signupPassword",
    "signupConfirm",
  ];

  signinEmail?.addEventListener("input", clearSigninMessage);
  signinPassword?.addEventListener("input", clearSigninMessage);

  signupInputs.forEach((inputId) => {
    const input = document.getElementById(inputId);
    input?.addEventListener("input", clearSignupMessage);
  });

  resetEmail?.addEventListener("input", clearForgotPasswordMessage);

  setupPasswordVisibilityToggles();

  const params = new URLSearchParams(window.location.search);
  const prefillEmail = (params.get("prefillEmail") || "").trim();

  if (prefillEmail) {
    const signupEmail = document.getElementById("signupEmail");
    if (signupEmail) {
      signupEmail.value = prefillEmail;
    }
  }

  if (params.get("mode") === "signin") {
    showSignInRoles();
  }
});
