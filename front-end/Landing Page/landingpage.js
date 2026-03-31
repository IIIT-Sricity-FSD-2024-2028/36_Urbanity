document.addEventListener("DOMContentLoaded", () => {
  const authPath = "../Authentication/auth.html";
  const contactCtaForm = document.getElementById("contactCtaForm");
  const contactEmailInput = document.getElementById("contactEmailInput");
  const contactGetStartedBtn = document.getElementById("contactGetStartedBtn");

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  };

  const getContactSignupUrl = () => {
    const email = String(contactEmailInput?.value || "").trim();
    return `${authPath}?prefillEmail=${encodeURIComponent(email)}`;
  };

  const getContactMessageNode = () => {
    if (!contactCtaForm) {
      return null;
    }

    let node = document.getElementById("contactFormMessage");
    if (node) {
      return node;
    }

    node = document.createElement("div");
    node.id = "contactFormMessage";
    node.className = "form-feedback form-feedback-error";
    node.style.display = "none";
    node.setAttribute("role", "alert");
    node.setAttribute("aria-live", "polite");
    contactCtaForm.appendChild(node);
    return node;
  };

  const setContactMessage = (text = "") => {
    const node = getContactMessageNode();
    if (!node) {
      return;
    }

    node.textContent = text;
    node.style.display = text ? "block" : "none";
  };

  const syncContactCtaState = () => {
    if (!contactGetStartedBtn || !contactEmailInput) {
      return;
    }

    contactGetStartedBtn.disabled = !isValidEmail(contactEmailInput.value);
    if (isValidEmail(contactEmailInput.value)) {
      setContactMessage("");
    }
  };

  const scrollToSection = (selector) => {
    const target = document.querySelector(selector);
    if (!target) {
      return;
    }

    const offset = 80;
    const elementPosition = target.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  };

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      scrollToSection(this.getAttribute("href"));
    });
  });

  document.getElementById("signInBtn")?.addEventListener("click", () => {
    window.location.href = `${authPath}?mode=signin`;
  });

  document.getElementById("getStartedBtn")?.addEventListener("click", () => {
    window.location.href = authPath;
  });

  document.getElementById("learnMoreBtn")?.addEventListener("click", () => {
    scrollToSection("#features");
  });

  document.getElementById("reportIssueBtn")?.addEventListener("click", () => {
    window.location.href = `${authPath}?mode=signin`;
  });

  document.getElementById("startReportingBtn")?.addEventListener("click", () => {
    window.location.href = authPath;
  });

  document.getElementById("accessDashboardBtn")?.addEventListener("click", () => {
    window.location.href = `${authPath}?mode=signin`;
  });

  contactEmailInput?.addEventListener("input", syncContactCtaState);
  syncContactCtaState();

  contactCtaForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!contactEmailInput || !isValidEmail(contactEmailInput.value)) {
      setContactMessage("Enter a valid email to continue.");
      contactEmailInput?.focus();
      return;
    }

    setContactMessage("");
    window.location.href = getContactSignupUrl();
  });
});
