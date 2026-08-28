document.addEventListener("DOMContentLoaded", () => {
  const authPath = "../Authentication/auth.html";
  const contactGetStartedBtn = document.getElementById("contactGetStartedBtn");

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

  contactGetStartedBtn?.addEventListener("click", () => {
    window.location.href = authPath;
  });
});
