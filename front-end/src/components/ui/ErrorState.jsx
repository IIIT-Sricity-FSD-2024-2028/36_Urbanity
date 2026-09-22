import { Button } from "./Button.jsx";

export function ErrorState({
  title = "Something went wrong",
  message = "Unable to load this content.",
  onRetry,
  retryLabel = "Try again",
}) {
  return (
    <div className="ui-error-state" role="alert">
      <span className="ui-state__icon" aria-hidden="true">!</span>
      <h2 className="ui-state__title">{title}</h2>
      <p>{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  );
}
