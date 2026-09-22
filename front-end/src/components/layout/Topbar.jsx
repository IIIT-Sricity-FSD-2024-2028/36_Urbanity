import { ProfileMenu } from "./ProfileMenu.jsx";

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Topbar({ title = "Urbanity Portal", onMenuToggle, notificationSlot }) {
  return (
    <header className="portal-topbar">
      <div className="portal-topbar__start">
        <button
          className="portal-topbar__menu"
          type="button"
          onClick={onMenuToggle}
          aria-label="Open navigation"
          aria-controls="portal-navigation"
        >
          <MenuIcon />
        </button>
        <p className="portal-topbar__title">{title}</p>
      </div>
      <div className="portal-topbar__actions">
        {notificationSlot}
        <ProfileMenu />
      </div>
    </header>
  );
}
