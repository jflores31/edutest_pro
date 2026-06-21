/**
 * Card.jsx — Contenedor Material Design 3
 * @param {string} title - Título opcional
 * @param {string} subtitle - Subtítulo opcional
 * @param {React.ReactNode} headerAction - Acción en el header (botones, etc)
 * @param {React.ReactNode} footer - Footer opcional
 * @param {'none'|'sm'|'md'|'lg'} padding - Padding del contenido
 * @param {'elevated'|'outlined'|'filled'} variant - Variante visual
 * @param {boolean} hoverable - Efecto hover
 * @param {React.ReactNode} children
 */
export default function Card({
  title,
  subtitle,
  headerAction,
  footer,
  padding = 'md',
  variant = 'elevated',
  hoverable = false,
  className = '',
  children,
  ...props
}) {
  const paddings = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-8',
  };

  const variantStyles = {
    elevated: 'bg-bg-1 shadow-card border border-transparent',
    outlined: 'bg-bg-1 border border-line',
    filled: 'bg-bg-2 border border-transparent',
  };

  const hoverStyles = hoverable
    ? 'hover:shadow-pop hover:border-accent/20 transition-all duration-200 cursor-pointer'
    : '';

  const hasHeader = title || subtitle || headerAction;

  return (
    <div
      className={`rounded-2xl ${variantStyles[variant]} ${hoverStyles} ${className}`}
      {...props}
    >
      {hasHeader && (
        <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line/50">
          <div className="min-w-0">
            {title && <div className="text-fg-0 font-semibold text-sm truncate">{title}</div>}
            {subtitle && <div className="text-fg-3 text-xs mt-0.5 truncate">{subtitle}</div>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </header>
      )}
      <div className={paddings[padding]}>{children}</div>
      {footer && (
        <footer className="px-5 py-3 border-t border-line/50 flex items-center justify-end gap-2">
          {footer}
        </footer>
      )}
    </div>
  );
}
