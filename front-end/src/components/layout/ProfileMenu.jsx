import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth.js";
import { getNavigationForRole } from "../../constants/navigation.js";

function initialsFor(label) {
  return label
    .replace(/\s+Portal$/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";
}

function ChevronIcon() {
  return <svg className="profile-menu__chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const navigation = getNavigationForRole(user?.role);
  const profilePath = navigation.items.find((item) => item.icon === "profile")?.to;

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const goToProfile = () => {
    setOpen(false);
    if (profilePath) navigate(profilePath);
  };

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <div className="profile-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        className="profile-menu__trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="portal-profile-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="profile-menu__avatar" aria-hidden="true">{initialsFor(navigation.label)}</span>
        <span className="profile-menu__label">Profile</span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="profile-menu__panel" id="portal-profile-menu" role="menu">
          <div className="profile-menu__details">
            <strong>{navigation.label}</strong>
            <span>{user?.email}</span>
          </div>
          {profilePath && <button className="profile-menu__item" type="button" role="menuitem" onClick={goToProfile}>View profile</button>}
          <button className="profile-menu__item profile-menu__item--danger" type="button" role="menuitem" onClick={handleLogout}>Log out</button>
        </div>
      )}
    </div>
  );
}
