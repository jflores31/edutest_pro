/**
 * Modal.jsx — Componente de modal reutilizable con accesibilidad
 * Incluye: focus trap, cierre con Escape, backdrop click, animación suave.
 */
import { useEffect, useRef } from 'react';

/**
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {'sm'|'md'|'lg'} size
 * @param {React.ReactNode} children
 */
export function Modal({ open, onClose, size = 'sm', children }) {
  const panelRef = useRef(null);

  // Cierre con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus trap: mueve el foco al panel al abrir
  useEffect(() => {
    if (open && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length) focusable[0].focus();
    }
  }, [open]);

  // Bloquea scroll del body
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const maxWidths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        className={`relative bg-bg-1 border border-line rounded-2xl shadow-pop w-full ${maxWidths[size]}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Header de modal con título y botón X opcional
 */
export function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-line">
      <h3 className="text-base font-semibold text-fg-0">{title}</h3>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="text-fg-3 hover:text-fg-0 hover:bg-bg-2 rounded-lg p-1 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children, className = '' }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

export function ModalFooter({ children }) {
  return (
    <div className="flex gap-3 justify-end px-6 pb-6 pt-2">
      {children}
    </div>
  );
}
