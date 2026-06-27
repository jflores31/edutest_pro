/**
 * StatusScreen.jsx — Pantalla de estado a pantalla completa, reutilizable.
 *
 * Reemplaza el patrón repetido "min-h-screen centrado → tarjeta con círculo de icono
 * + título + mensaje + acción opcional" que estaba duplicado en el login del alumno,
 * la pantalla de resultados y la de error del examen.
 *
 * Props:
 *  - icon:    nombre de icono del design-system (default 'info')
 *  - tone:    'ok' | 'danger' | 'warn' | 'neutral' (color del círculo/icono)
 *  - title:   título (string)
 *  - message: texto descriptivo (string) — o usa `children` para contenido libre
 *  - action:  nodo opcional (botón) al pie
 *  - maxWidth: 'sm' | 'md' (ancho de la tarjeta)
 */
import { Icon } from '../design-system';

const TONE = {
  ok:      { circle: 'bg-ok/10',     icon: 'text-ok' },
  danger:  { circle: 'bg-danger/10', icon: 'text-danger' },
  warn:    { circle: 'bg-warn/10',   icon: 'text-warn' },
  neutral: { circle: 'bg-bg-2',      icon: 'text-fg-2' },
};

export default function StatusScreen({
  icon = 'info',
  tone = 'neutral',
  title,
  message,
  action,
  children,
  maxWidth = 'sm',
}) {
  const t = TONE[tone] || TONE.neutral;
  const width = maxWidth === 'md' ? 'max-w-md' : 'max-w-sm';

  return (
    <div className="min-h-screen bg-bg grid place-items-center p-6">
      <div className={`bg-bg-1 shadow-card border border-line rounded-2xl p-8 w-full text-center ${width}`}>
        <div className={`grid h-16 w-16 place-items-center rounded-full mx-auto mb-4 ${t.circle}`}>
          <Icon name={icon} size={28} className={t.icon} />
        </div>
        {title && <h1 className="text-xl font-semibold text-fg-0 mb-2">{title}</h1>}
        {message && <p className="text-sm text-fg-2 mb-6">{message}</p>}
        {children}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
