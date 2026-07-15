import type { ToastMessage } from "@/components/control/controlTypes";

interface ToastListProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  onAction?: (id: string) => void;
}

export function ToastList({ toasts, onDismiss, onAction }: ToastListProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast toast--${toast.type}`}>
          <div className="toast__content">
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>
          <div className="toast__actions">
            {toast.actionLabel ? (
              <button type="button" className="toast__action" onClick={() => onAction?.(toast.id)}>
                {toast.actionLabel}
              </button>
            ) : null}
            <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="토스트 닫기">
              ×
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

