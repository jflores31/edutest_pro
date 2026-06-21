import { createContext, useContext, useState, useCallback } from 'react';

const ToastCtx = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const STYLES = {
  success: 'bg-ok/10 border-ok/30 text-ok',
  error: 'bg-danger/10 border-danger/30 text-danger',
  info: 'bg-accent/10 border-accent/30 text-accent',
};

function ToastItem({ toast, onDismiss }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-pop text-sm font-medium ${STYLES[toast.type] || STYLES.info} animate-slide-up pointer-events-auto`}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        {toast.type === 'success' && <path d="M3 8.5l3 3 7-7" />}
        {toast.type === 'error' && (
          <><circle cx="8" cy="8" r="6" /><path d="M8 7v4M8 5v.5" /></>
        )}
        {toast.type === 'info' && (
          <><circle cx="8" cy="8" r="6" /><path d="M8 7v4M8 5v.5" /></>
        )}
      </svg>
      <span className="flex-1">{toast.msg}</span>
      <button onClick={() => onDismiss(toast.id)} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const toast = {
    success: msg => add('success', msg),
    error:   msg => add('error',   msg),
    info:    msg => add('info',    msg),
  };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
