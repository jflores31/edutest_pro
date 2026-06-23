/**
 * Sidebar.jsx — Navegación lateral persistente (MD3)
 * Usa react-router-dom v6 para navegación activa
 */
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Icon } from '../design-system';
import NotificationBell from '../features/notifications/NotificationBell';

const NAV = [
  { to: '/teacher/dashboard', icon: 'chart', label: 'Dashboard' },
  { to: '/teacher/exams', icon: 'book', label: 'Exámenes' },
  { to: '/teacher/bank', icon: 'template', label: 'Banco' },
  { to: '/teacher/students', icon: 'users', label: 'Alumnos' },
  { to: '/teacher/import', icon: 'upload', label: 'Importar' },
  { to: '/teacher/monitoring', icon: 'eye', label: 'Monitoreo' },
  { to: '/teacher/compare', icon: 'trend', label: 'Comparativa' },
  { to: '/teacher/settings', icon: 'settings', label: 'Configuración' },
];

export default function Sidebar({ mobileOpen = false, collapsed = false, onClose = () => {}, onCollapse = () => {} }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-bg-1 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'md:hidden' : ''}`}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-line px-5">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-sm font-bold text-bg-1">
          E
        </div>
        <span className="text-base font-semibold text-fg-0">EduTest Pro</span>
        <div className="ml-auto flex items-center">
          {/* Ocultar el menú (escritorio) */}
          <button
            onClick={onCollapse}
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
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'text-fg-1 hover:bg-bg-2 hover:text-fg-0'
              }`
            }
          >
            <Icon name={item.icon} size={16} strokeWidth={1.8} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/teacher/exams/new"
          onClick={onClose}
          className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium bg-accent text-bg-1 hover:bg-accent-hover transition-all duration-150 shadow-sm"
        >
          <Icon name="plus" size={16} strokeWidth={2} />
          <span>Nuevo examen</span>
        </NavLink>
      </nav>

      {/* Theme toggle + User */}
      <div className="border-t border-line p-3 space-y-2">
        {/* Notification bell */}
        <NotificationBell />
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-fg-2 hover:bg-bg-2 hover:text-fg-0 transition-colors"
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} strokeWidth={1.8} />
          <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>

        {/* User */}
        <div className="flex items-center gap-3 rounded-xl p-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {(user?.first_name?.[0] || 'D').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-fg-0">
              {user?.first_name || 'Docente'} {user?.last_name || ''}
            </div>
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
      </div>
    </aside>
  );
}
