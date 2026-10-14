function initialsFor(name, email, role) {
  const source = name?.trim() || email?.split("@")[0] || role || "Urbanity";
  return source
    .split(/\s+|[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function VerifiedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function ProfileHero({ name, email, role, eyebrow = "Authenticated account" }) {
  return (
    <section className="portal-profile__hero">
      <div className="portal-profile__avatar" aria-hidden="true">{initialsFor(name, email, role)}</div>
      <div className="portal-profile__identity">
        <p className="portal-profile__eyebrow">{eyebrow}</p>
        <h2>{name || email || role}</h2>
        {name && email && <p>{email}</p>}
        <span className="portal-profile__role">{role}</span>
      </div>
      <span className="portal-profile__verified"><VerifiedIcon /> Signed in</span>
    </section>
  );
}
