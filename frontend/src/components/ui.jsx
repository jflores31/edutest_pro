import { Loader2 } from 'lucide-react'

// eslint-disable-next-line react-refresh/only-export-components
export const cx = (...c) => c.filter(Boolean).join(' ')

export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-base' }
  const variants = {
    primary: 'text-[var(--accent-fg)]',
    ghost: 'text-[var(--fg-1)] hover:bg-[var(--bg-2)]',
    outline: 'border text-[var(--fg-0)] hover:bg-[var(--bg-2)]',
    danger: 'text-white',
  }
  const style =
    variant === 'primary' ? { background: 'var(--accent)' }
      : variant === 'danger' ? { background: 'var(--danger)' }
        : variant === 'outline' ? { borderColor: 'var(--line)' } : undefined
  return (
    <button className={cx(base, sizes[size], variants[variant], className)} style={style} disabled={disabled || loading} {...props}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cx('rounded-[var(--radius)] border p-4', className)}
      style={{ background: 'var(--bg-1)', borderColor: 'var(--line)' }}
      {...props}
    >
      {children}
    </div>
  )
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-sm" style={{ color: 'var(--fg-1)' }}>{label}</span>}
      {children}
      {hint && !error && <span className="text-xs" style={{ color: 'var(--fg-2)' }}>{hint}</span>}
      {error && <span className="text-xs" style={{ color: 'var(--danger)' }}>{error}</span>}
    </label>
  )
}

const inputCls = 'h-10 w-full rounded-[10px] border px-3 text-sm outline-none focus:border-[var(--accent)]'
const inputStyle = { background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--fg-0)' }

export function Input({ className, ...props }) {
  return <input className={cx(inputCls, className)} style={inputStyle} {...props} />
}

export function Textarea({ className, ...props }) {
  return <textarea className={cx('w-full rounded-[10px] border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]', className)} style={inputStyle} {...props} />
}

export function Select({ className, children, ...props }) {
  return <select className={cx(inputCls, className)} style={inputStyle} {...props}>{children}</select>
}

export function Badge({ tone = 'default', children }) {
  const tones = {
    default: { bg: 'var(--bg-2)', fg: 'var(--fg-1)' },
    ok: { bg: 'color-mix(in srgb, var(--ok) 18%, transparent)', fg: 'var(--ok)' },
    warn: { bg: 'color-mix(in srgb, var(--warn) 18%, transparent)', fg: 'var(--warn)' },
    danger: { bg: 'color-mix(in srgb, var(--danger) 18%, transparent)', fg: 'var(--danger)' },
    accent: { bg: 'color-mix(in srgb, var(--accent) 18%, transparent)', fg: 'var(--accent)' },
  }
  const t = tones[tone] || tones.default
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: t.bg, color: t.fg }}>{children}</span>
}

export function Spinner({ size = 20 }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: 'var(--fg-2)' }} />
}

export function Center({ children, className }) {
  return <div className={cx('flex items-center justify-center', className)} style={{ minHeight: 200 }}>{children}</div>
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {Icon && <Icon size={32} style={{ color: 'var(--fg-2)' }} />}
      <p className="text-base font-medium">{title}</p>
      {hint && <p className="text-sm" style={{ color: 'var(--fg-2)' }}>{hint}</p>}
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm" style={{ color: 'var(--fg-2)' }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function ErrorState({ error }) {
  return (
    <Card className="text-center" style={{ borderColor: 'var(--danger)' }}>
      <p className="text-sm" style={{ color: 'var(--danger)' }}>
        {error?.message || 'Ocurrió un error al cargar los datos.'}
      </p>
    </Card>
  )
}
