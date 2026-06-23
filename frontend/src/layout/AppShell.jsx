import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import { Icon } from '../design-system';

export default function AppShell() {
  const { user, isAuthenticated, loading } = useAuth();
  const [navOpen, setNavOpen] = useState(false);     // drawer móvil
  const [collapsed, setCollapsed] = useState(false); // menú oculto en escritorio

  // Cierra el drawer con Escape (al navegar se cierra vía onClose en cada NavLink)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
          <div className="h-10 w-10 rounded-full border-[3px] border-accent border-t-transparent animate-spin" />
          <p className="text-sm text-fg-2">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && user.role === 'STUDENT') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-bg text-fg-1">
      <Sidebar
        mobileOpen={navOpen}
        collapsed={collapsed}
        onClose={() => setNavOpen(false)}
        onCollapse={() => setCollapsed(true)}
      />

      {/* Overlay (solo móvil, con drawer abierto) */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Botón flotante para volver a mostrar el menú en escritorio */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Mostrar menú"
          title="Mostrar menú"
          className="hidden md:flex fixed top-3 left-3 z-50 items-center justify-center rounded-xl border border-line bg-bg-1 p-2 text-fg-1 shadow-pop hover:bg-bg-2 transition-colors"
        >
          <Icon name="menu" size={18} />
        </button>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior solo-móvil con hamburguesa */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg-1 px-4 md:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menú"
            className="rounded-xl p-2 text-fg-1 hover:bg-bg-2 transition-colors"
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-xs font-bold text-bg-1">
              E
            </div>
            <span className="text-sm font-semibold text-fg-0">EduTest Pro</span>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}