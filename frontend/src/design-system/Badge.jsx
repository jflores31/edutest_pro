/**
 * Badge.jsx — Pill de estado Material Design 3
 * @param {'success'|'warning'|'danger'|'neutral'|'accent'|'info'} variant
 * @param {boolean} dot - Mostrar punto indicador
 * @param {React.ReactNode} children
 */
export default function Badge({
  variant = 'neutral',
  dot = false,
  className = '',
  children,
  ...props
}) {
  const variants = {
    success: 'bg-ok-soft text-ok border-ok/20',
    ok:      'bg-ok-soft text-ok border-ok/20',
    warning: 'bg-warn-soft text-warn border-warn/20',
    warn:    'bg-warn-soft text-warn border-warn/20',
    danger:  'bg-danger-soft text-danger border-danger/20',
    neutral: 'bg-bg-2 text-fg-2 border-line',
    accent:  'bg-accent-soft text-accent border-accent/20',
    info:    'bg-blue-500/10 text-blue-500 border-blue-500/20',
    // Tonos educativos
    indigo:  'bg-ic-indigo-soft text-ic-indigo border-ic-indigo/25',
    violet:  'bg-ic-violet-soft text-ic-violet border-ic-violet/25',
    teal:    'bg-ic-teal-soft text-ic-teal border-ic-teal/25',
    amber:   'bg-ic-amber-soft text-ic-amber border-ic-amber/25',
    sky:     'bg-ic-sky-soft text-ic-sky border-ic-sky/25',
    emerald: 'bg-ic-emerald-soft text-ic-emerald border-ic-emerald/25',
    rose:    'bg-ic-rose-soft text-ic-rose border-ic-rose/25',
  };

  const dotColors = {
    success: 'bg-ok',
    ok:      'bg-ok',
    warning: 'bg-warn',
    warn:    'bg-warn',
    danger:  'bg-danger',
    neutral: 'bg-fg-3',
    accent:  'bg-accent',
    info:    'bg-blue-500',
    indigo:  'bg-ic-indigo',
    violet:  'bg-ic-violet',
    teal:    'bg-ic-teal',
    amber:   'bg-ic-amber',
    sky:     'bg-ic-sky',
    emerald: 'bg-ic-emerald',
    rose:    'bg-ic-rose',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
