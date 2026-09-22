import { useId } from "react";
import { FormField, fieldDescriptionId } from "./FormField.jsx";

export function Input({ id, label, hint, error, required = false, className = "", ...props }) {
  const generatedId = useId();
  const controlId = id || generatedId;

  return (
    <FormField controlId={controlId} label={label} hint={hint} error={error} required={required}>
      <input
        {...props}
        id={controlId}
        required={required}
        className={["ui-input", className].filter(Boolean).join(" ")}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={fieldDescriptionId(controlId, hint, error)}
      />
    </FormField>
  );
}
