import { StatusBadge } from "../../../components/data-display/index.js";
import { formatEnum } from "../utils/formatters.js";

// Renders counts computed from backend records. `bars` adds a proportional
// indicator; values are never estimated or padded.
export function Breakdown({ values = {}, status = false, bars = false, order, emptyMessage = "No data available." }) {
  const entries = order
    ? order.filter((key) => key in values).map((key) => [key, values[key]])
    : Object.entries(values).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <p className="tr-muted">{emptyMessage}</p>;
  const max = Math.max(...entries.map(([, value]) => value));

  return (
    <ul className="tr-breakdown">
      {entries.map(([key, value]) => (
        <li key={key}>
          <div className="tr-breakdown__row">
            <span>{status ? <StatusBadge status={key} /> : formatEnum(key)}</span>
            <strong>{value}</strong>
          </div>
          {bars && (
            <span className="tr-breakdown__track" aria-hidden="true">
              <span style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` }} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
