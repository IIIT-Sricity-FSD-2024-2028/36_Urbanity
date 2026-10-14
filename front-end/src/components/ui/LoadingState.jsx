export function Spinner({ label = "Loading" }) {
  return <span className="ui-spinner" role="status" aria-label={label} />;
}

export function LoadingState({ message = "Loading..." }) {
  return (
    <div className="ui-loading-state" role="status">
      <div className="ui-loading-skeleton" aria-hidden="true"><span /><span /><span /></div>
      <p>{message}</p>
    </div>
  );
}
