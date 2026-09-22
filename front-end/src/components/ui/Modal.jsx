import { useEffect, useId, useRef } from "react";

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
}) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    if (closeOnOverlay && event.target === event.currentTarget) onClose?.();
  };

  return (
    <div className="ui-modal__overlay" onMouseDown={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={`ui-modal ui-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Dialog"}
        tabIndex={-1}
      >
        <header className="ui-modal__header">
          {title && <h2 className="ui-modal__title" id={titleId}>{title}</h2>}
          <button className="ui-modal__close" type="button" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer && <footer className="ui-modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}
