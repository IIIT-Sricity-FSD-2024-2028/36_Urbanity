export function Button({
  variant = "primary",
  loading = false,
  loadingLabel = "Working...",
  fullWidth = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}) {
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    loading ? "ui-button--loading" : "",
    fullWidth ? "ui-button--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className="ui-button__spinner" aria-hidden="true" />}
      {loading ? loadingLabel : children}
    </button>
  );
}
