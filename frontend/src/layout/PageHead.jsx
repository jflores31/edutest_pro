/**
 * PageHead.jsx — Header de página con breadcrumb, título y acciones (MD3)
 * @param {string[]} breadcrumb - Array de breadcrumbs
 * @param {string} title - Título de la página
 * @param {string} subtitle - Subtítulo
 * @param {React.ReactNode} actions - Botones de acción a la derecha
 */
import { Link } from 'react-router-dom';
import { Icon } from '../design-system';

export default function PageHead({
  breadcrumb = [],
  title,
  subtitle,
  actions,
}) {
  return (
    <header className="border-b border-line bg-bg px-8 py-6">
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

      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-fg-0">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-fg-3 leading-relaxed">{subtitle}</p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
