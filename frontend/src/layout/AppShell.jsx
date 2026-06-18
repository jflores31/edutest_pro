import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, FileText, Library, Users, Upload, Activity,
  GitCompareArrows, Settings, LogOut, Moon, Sun, GraduationCap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/teacher/exams', label: 'Exámenes', icon: FileText },
  { to: '/teacher/bank', label: 'Banco', icon: Library },
  { to: '/teacher/students', label: 'Estudiantes', icon: Users },
  { to: '/teacher/import', label: 'Importar', icon: Upload },
  { to: '/teacher/monitoring', label: 'Monitoreo', icon: Activity },
  { to: '/teacher/compare', label: 'Comparar', icon: GitCompareArrows },
  { to: '/teacher/settings', label: 'Ajustes', icon: Settings },
]

function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark',
  )
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('edutest_theme', theme) } catch { /* ignore */ }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, toggleTheme] = useTheme()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-0)' }}>
      <aside className="flex w-60 flex-col border-r p-4" style={{ borderColor: 'var(--line)', background: 'var(--bg-1)' }}>
        <div className="mb-6 flex items-center gap-2 px-2">
          <GraduationCap size={22} style={{ color: 'var(--accent)' }} />
          <span className="text-lg font-semibold">EduTest Pro</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm"
              style={({ isActive }) => ({
                background: isActive ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--fg-1)',
                fontWeight: isActive ? 600 : 400,
              })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
          <div className="px-2 text-xs" style={{ color: 'var(--fg-2)' }}>
            {user?.username} · {user?.role}
          </div>
          <button onClick={toggleTheme} className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm hover:bg-[var(--bg-2)]" style={{ color: 'var(--fg-1)' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          </button>
          <button onClick={handleLogout} className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm hover:bg-[var(--bg-2)]" style={{ color: 'var(--danger)' }}>
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
