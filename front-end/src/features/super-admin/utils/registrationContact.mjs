export function registrationContact(email) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Urbanity community registration")}&body=${encodeURIComponent("Hello, I would like to discuss your community registration application.")}`;
}
