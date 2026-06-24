/**
 * PageHead.jsx — Header de página con breadcrumb, título y acciones (MD3)
 * @param {string[]} breadcrumb - Array de breadcrumbs
 * @param {string} title - Título de la página
 * @param {string} subtitle - Subtítulo
 * @param {React.ReactNode} actions - Botones de acción a la derecha
 */
import { Link } from 'react-router-dom';
import { Icon } from '../design-system';

// Icono + tono por sección (derivado del breadcrumb) para colorear el encabezado.
const SECTION = {
  'dashboard': { icon: 'chart', tone: 'violet' },
  'exámenes': { icon: 'book', tone: 'indigo' },
  'examenes': { icon: 'book', tone: 'indigo' },
  'banco de preguntas': { icon: 'template', tone: 'amber' },
  'banco': { icon: 'template', tone: 'amber' },
  'alumnos': { icon: 'users', tone: 'teal' },
  'importar': { icon: 'upload', tone: 'sky' },
  'monitoreo': { icon: 'eye', tone: 'rose' },
  'comparativa': { icon: 'trend', tone: 'emerald' },
  'configuración': { icon: 'settings', tone: 'slate' },
  'configuracion': { icon: 'settings', tone: 'slate' },
  'intentos': { icon: 'file', tone: 'indigo' },
};

export default function PageHead({
  breadcrumb = [],
  title,
  subtitle,
  actions,
  icon,       // opcional: fuerza el icono del encabezado
  iconTone,   // opcional: fuerza el tono
}) {
  const sec = icon
    ? { icon, tone: iconTone }
    : SECTION[(breadcrumb[0] || '').toLowerCase()];
  return (
    <header className="border-b border-line bg-bg px-4 py-5 sm:px-8 sm:py-6">
      {breadcrumb.length > 0 && (
        <nav className="mb-3 flex items-center gap-1.5 text-xs text-fg-3">
          <Link to="/teacher/dashboard" className="hover:text-fg-1 transition-colors">
            Inicio
          </Link>
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <Icon name="chevron-right" size={12} strokeWidth={2} className="text-fg-3/60" />
              <span className={i === breadcrumb.length - 1 ? 'text-fg-2 font-medium' : 'hover:text-fg-1 cursor-pointer transition-colors'}>
                {crumb}
              </span>
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          {sec?.icon && (
            <Icon name={sec.icon} tone={sec.tone} variant="chip" size={22} strokeWidth={1.9} className="shrink-0 self-start" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl sm:text-2xl font-bold tracking-tight text-fg-0">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-fg-3 leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">{actions}</div>
        )}
      </div>
    </header>
  );
}
