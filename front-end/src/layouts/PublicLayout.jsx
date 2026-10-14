import { Outlet } from "react-router-dom";

export function PublicLayout({ children }) {
  return <div className="public-layout"><a className="skip-link" href="#public-main-content">Skip to content</a>{children ?? <Outlet />}</div>;
}
