export function MetricCard({ label, value, hint, icon }) {
  return (
    <article className="metric-card">
      {icon && <span className="metric-card__icon" aria-hidden="true">{icon}</span>}
      <div>
        <strong className="metric-card__value">{value}</strong>
        <span className="metric-card__label">{label}</span>
        {hint && <span className="metric-card__hint">{hint}</span>}
      </div>
    </article>
  );
}
