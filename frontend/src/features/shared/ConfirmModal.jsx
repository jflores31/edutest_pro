import { useEffect } from 'react';
import { Button } from '../../design-system';

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Eliminar',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-bg-1 border border-line rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-pop"
        onClick={e => e.stopPropagation()}
      >
        {title && <h3 className="text-fg-0 font-semibold text-base">{title}</h3>}
        <p className="text-fg-2 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
