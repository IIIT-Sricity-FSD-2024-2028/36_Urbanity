export function EmptyState({ title = "Nothing here yet", message, icon = "—", action }) {
  return (
    <div className="ui-empty-state">
      <span className="ui-state__icon" aria-hidden="true">{icon}</span>
      <h2 className="ui-state__title">{title}</h2>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
