export function FormField({
  controlId,
  label,
  required = false,
  hint,
  error,
  className = "",
  children,
}) {
  return (
    <div className={["ui-field", className].filter(Boolean).join(" ")}>
      {label && (
        <label className="ui-field__label" htmlFor={controlId}>
          {label} {required && <span className="ui-field__required">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="ui-field__hint" id={`${controlId}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="ui-field__error" id={`${controlId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function fieldDescriptionId(controlId, hint, error) {
  if (error) return `${controlId}-error`;
  if (hint) return `${controlId}-hint`;
  return undefined;
}
