import { Button } from "./Button.jsx";
import { Modal } from "./Modal.jsx";

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm action",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  loading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      closeOnOverlay={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="ui-confirm-dialog__message">{message}</p>
    </Modal>
  );
}
