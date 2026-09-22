import { Outlet } from "react-router-dom";

export function PublicLayout({ children }) {
  return <div className="public-layout">{children ?? <Outlet />}</div>;
}
