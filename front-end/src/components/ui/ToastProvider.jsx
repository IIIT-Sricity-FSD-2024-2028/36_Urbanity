import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastContext } from "./ToastContext.js";

const TOAST_TYPES = new Set(["success", "error", "info", "warning"]);
let nextToastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = "info", message, duration = 4000 }) => {
      if (!message) return null;

      const id = ++nextToastId;
      const safeType = TOAST_TYPES.has(type) ? type : "info";
      setToasts((current) => [...current, { id, type: safeType, message }]);

      if (duration > 0) {
        timers.current.set(
          id,
          window.setTimeout(() => dismissToast(id), duration),
        );
      }

      return id;
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            className={`ui-toast ui-toast--${toast.type}`}
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
          >
            <p>{toast.message}</p>
            <button
              className="ui-toast__close"
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
