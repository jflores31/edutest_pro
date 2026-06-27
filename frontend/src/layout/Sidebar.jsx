/**
 * Sidebar.jsx — Navegación lateral persistente (MD3)
 * Usa react-router-dom v6 para navegación activa.
 *
 * Estados:
 *  - Escritorio expandido (w-60): iconos + etiquetas.
 *  - Escritorio colapsado (w-16): SOLO iconos centrados (rail) con tooltip.
 *    El colapso es responsivo (clases `md:`) → en móvil siempre se ve completo.
 *  - Móvil: drawer deslizable de ancho completo.
 */
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Icon } from '../design-system';
import NotificationBell from '../features/notifications/NotificationBell';

const NAV = [
  { to: '/teacher/dashboard', icon: 'chart', label: 'Dashboard', tone: 'violet' },
  { to: '/teacher/exams', icon: 'book', label: 'Exámenes', tone: 'indigo' },
  { to: '/teacher/bank', icon: 'template', label: 'Banco', tone: 'amber' },
  { to: '/teacher/students', icon: 'users', label: 'Alumnos', tone: 'teal' },
  { to: '/teacher/import', icon: 'upload', label: 'Importar', tone: 'sky' },
  { to: '/teacher/monitoring', icon: 'eye', label: 'Monitoreo', tone: 'rose' },
  { to: '/teacher/compare', icon: 'trend', label: 'Comparativa', tone: 'emerald' },
  { to: '/teacher/settings', icon: 'settings', label: 'Configuración', tone: 'slate' },
];

export default function Sidebar({ mobileOpen = false, collapsed = false, onClose = () => {}, onToggleCollapse = () => {} }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Clases reutilizables para el modo rail (solo afectan a md+)
  const railRow = collapsed ? 'md:justify-center md:px-0' : '';
  const railLabel = collapsed ? 'md:hidden' : '';
  const userName = `${user?.first_name || 'Docente'} ${user?.last_name || ''}`.trim();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-bg-1 transition-[transform,width] duration-200 md:static md:z-auto md:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'md:w-16' : ''}`}
    >
      {/* Brand */}
      <div className={`flex h-16 items-center gap-3 border-b border-line px-5 ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, var(--color-ic-indigo), var(--color-ic-violet))' }}>
          E
        </div>
        <span className={`text-base font-semibold text-fg-0 ${railLabel}`}>EduTest Pro</span>
        <div className={`ml-auto flex items-center ${collapsed ? 'md:hidden' : ''}`}>
          {/* Colapsar el menú (escritorio) */}
          <button
            onClick={onToggleCollapse}
            aria-label="Ocultar menú"
            title="Ocultar menú"
            className="hidden md:flex rounded-xl p-1.5 text-fg-3 hover:bg-bg-2 hover:text-fg-0 transition-colors"
          >
            <Icon name="chevron-left" size={18} />
          </button>
          {/* Cerrar el drawer (móvil) */}
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="md:hidden rounded-xl p-1.5 text-fg-3 hover:bg-bg-2 hover:text-fg-0 transition-colors"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3">
        {/* Expandir el rail (solo visible colapsado, escritorio) */}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            aria-label="Mostrar menú"
            title="Mostrar menú"
            className="mb-2 hidden md:flex w-full items-center justify-center rounded-xl p-2.5 text-fg-3 hover:bg-bg-2 hover:text-fg-0 transition-colors"
          >
            <Icon name="chevron-right" size={18} />
          </button>
        )}

        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 ${railRow} ${
                isActive
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'text-fg-1 hover:bg-bg-2 hover:text-fg-0'
              }`
            }
          >
            <Icon name={item.icon} size={16} strokeWidth={1.9} variant="soft" tone={item.tone} />
            <span className={railLabel}>{item.label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/teacher/exams/new"
          onClick={onClose}
          title={collapsed ? 'Nuevo examen' : undefined}
          className={`mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium bg-accent text-bg-1 hover:bg-accent-hover transition-all duration-150 shadow-sm ${railRow}`}
        >
          <Icon name="plus" size={16} strokeWidth={2} />
          <span className={railLabel}>Nuevo examen</span>
        </NavLink>
      </nav>

      {/* Theme toggle + User */}
      <div className="border-t border-line p-3 space-y-2">
        {/* Notification bell */}
        <NotificationBell collapsed={collapsed} />
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={collapsed ? (theme === 'dark' ? 'Modo claro' : 'Modo oscuro') : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-fg-2 hover:bg-bg-2 hover:text-fg-0 transition-colors ${railRow}`}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} strokeWidth={1.8} />
          <span className={railLabel}>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>

        {/* User — versión expandida (oculta en rail md+) */}
        <div className={`flex items-center gap-3 rounded-xl p-2 ${collapsed ? 'md:hidden' : ''}`}>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {(user?.first_name?.[0] || 'D').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-fg-0">{userName}</div>
            <div className="truncate text-xs text-fg-3">{user?.email || ''}</div>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="rounded-xl p-1.5 text-fg-3 hover:bg-bg-2 hover:text-fg-0 transition-colors"
          >
            <Icon name="logout" size={16} />
          </button>
        </div>

        {/* User — versión rail (solo md+ colapsado): avatar + logout en columna */}
        {collapsed && (
          <div className="hidden md:flex flex-col items-center gap-1">
            <div
              className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
              title={userName}
            >
              {(user?.first_name?.[0] || 'D').toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="grid h-9 w-9 place-items-center rounded-xl text-fg-3 hover:bg-bg-2 hover:text-fg-0 transition-colors"
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
