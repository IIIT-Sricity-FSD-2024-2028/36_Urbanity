import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth.js";
import { getNavigationForRole } from "../../constants/navigation.js";
import { Button } from "../ui/Button.jsx";

function initialsFor(user) {
  const source = user?.email?.split("@")[0] || "Urbanity";
  return source
    .split(/[._-]+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const navigation = getNavigationForRole(user?.role);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <div className="profile-menu" ref={containerRef}>
      <button
        className="profile-menu__trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="profile-menu__avatar" aria-hidden="true">{initialsFor(user)}</span>
        <span className="profile-menu__identity">
          <strong>{navigation.label}</strong>
          <span>{user?.email}</span>
        </span>
        <span aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="profile-menu__panel" role="menu">
          <div className="profile-menu__details">
            <strong>{navigation.label}</strong>
            <span>{user?.email}</span>
            <span>{user?.role}</span>
          </div>
          <Button
            className="profile-menu__logout"
            variant="danger"
            fullWidth
            role="menuitem"
            onClick={handleLogout}
          >
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
