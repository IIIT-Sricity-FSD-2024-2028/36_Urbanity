export function Badge({ variant = "neutral", className = "", children, ...props }) {
  return (
    <span
      {...props}
      className={["ui-badge", `ui-badge--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
