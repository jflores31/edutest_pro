import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info }
const COLORS = { success: 'var(--ok)', error: 'var(--danger)', info: 'var(--accent)' }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback((message, type = 'info', timeout = 4000) => {
    const id = crypto.randomUUID()
    setToasts((t) => [...t, { id, message, type }])
    if (timeout) setTimeout(() => remove(id), timeout)
    return id
  }, [remove])

  const toast = {
    success: (m, t) => push(m, 'success', t),
    error: (m, t) => push(m, 'error', t),
    info: (m, t) => push(m, 'info', t),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          return (
            <div
              key={t.id}
              role="status"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, minWidth: 260, maxWidth: 380,
                padding: '10px 12px', borderRadius: 'var(--radius)', background: 'var(--bg-2)',
                border: '1px solid var(--line)', boxShadow: 'var(--shadow)', color: 'var(--fg-0)',
              }}
            >
              <Icon size={18} style={{ color: COLORS[t.type], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14 }}>{t.message}</span>
              <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', color: 'var(--fg-2)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
