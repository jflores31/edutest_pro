/**
 * Button.jsx — Botón Material Design 3
 * @param {'primary'|'secondary'|'ghost'|'danger'|'tonal'} variant
 * @param {'sm'|'md'|'lg'} size
 * @param {boolean} disabled
 * @param {React.ReactNode} icon - Icono opcional a la izquierda
 * @param {React.ReactNode} children
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  icon,
  children,
  className = '',
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary: 'bg-accent text-bg-1 hover:bg-accent-hover active:scale-[0.98] shadow-sm',
    secondary: 'bg-bg-2 text-fg-1 border border-line hover:bg-bg-3 hover:text-fg-0 active:bg-bg-3/80',
    ghost: 'text-fg-2 hover:bg-bg-2 hover:text-fg-0 active:bg-bg-3',
    danger: 'bg-danger-soft text-danger border border-danger/20 hover:bg-danger/15 active:bg-danger/25',
    tonal: 'bg-accent-soft text-accent hover:bg-accent/15 active:bg-accent/20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };

  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0 [&>svg]:align-middle">{icon}</span>}
      {children}
    </button>
  );
}
