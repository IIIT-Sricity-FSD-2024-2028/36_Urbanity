import { useId } from "react";
import { FormField, fieldDescriptionId } from "./FormField.jsx";

export function Select({ id, label, hint, error, required = false, className = "", children, ...props }) {
  const generatedId = useId();
  const controlId = id || generatedId;

  return (
    <FormField controlId={controlId} label={label} hint={hint} error={error} required={required}>
      <select
        {...props}
        id={controlId}
        required={required}
        className={["ui-select", className].filter(Boolean).join(" ")}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={fieldDescriptionId(controlId, hint, error)}
      >
        {children}
      </select>
    </FormField>
  );
}
