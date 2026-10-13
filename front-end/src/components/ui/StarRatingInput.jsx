export function StarRatingInput({ label, name, value, onChange, disabled = false, error, required = false }) {
  const numericValue = Number(value) || 0;
  const errorId = error ? `${name}-rating-error` : undefined;

  return (
    <fieldset className="ui-star-rating" disabled={disabled} aria-describedby={errorId}>
      <legend className="ui-field__label">
        {label} {required && <span className="ui-field__required">*</span>}
      </legend>
      <div className="ui-star-rating__options">
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating} className={rating <= numericValue ? "ui-star-rating__option ui-star-rating__option--selected" : "ui-star-rating__option"}>
            <input
              type="radio"
              name={name}
              value={rating}
              checked={numericValue === rating}
              onChange={() => onChange(rating)}
            />
            <span aria-hidden="true">★</span>
            <span className="sr-only">{rating} star{rating === 1 ? "" : "s"}</span>
          </label>
        ))}
      </div>
      <p className="ui-star-rating__summary">{numericValue ? `${numericValue} out of 5 selected` : "No rating selected"}</p>
      {error && <p className="ui-field__error" id={errorId}>{error}</p>}
    </fieldset>
  );
}
