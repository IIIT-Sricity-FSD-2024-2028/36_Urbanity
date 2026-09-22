export function Card({
  title,
  actions,
  children,
  flush = false,
  className = "",
  ...props
}) {
  return (
    <section {...props} className={["ui-card", className].filter(Boolean).join(" ")}>
      {(title || actions) && (
        <header className="ui-card__header">
          {title && <h2 className="ui-card__title">{title}</h2>}
          {actions && <div>{actions}</div>}
        </header>
      )}
      <div className={`ui-card__content${flush ? " ui-card__content--flush" : ""}`}>
        {children}
      </div>
    </section>
  );
}
