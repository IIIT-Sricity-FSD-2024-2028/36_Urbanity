export function RatingStars({ value, showValue = true, className = "" }) {
  const numericValue = Number(value);
  const rating = Number.isFinite(numericValue) ? Math.min(5, Math.max(0, numericValue)) : 0;
  const filled = Math.round(rating);
  const label = `${rating.toFixed(1)} out of 5 stars`;

  return (
    <span className={["rating-stars", className].filter(Boolean).join(" ")} aria-label={label} title={label}>
      <span className="rating-stars__icons" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={star <= filled ? "rating-stars__star--filled" : undefined}>★</span>
        ))}
      </span>
      {showValue && <span className="rating-stars__value">{rating.toFixed(1)}</span>}
    </span>
  );
}
