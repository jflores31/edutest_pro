import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { clearColorCache } from '../features/charts/chart-theme';

const ThemeContext = createContext(null);

function getInitialTheme() {
  try {
    const stored = localStorage.getItem('edutest_theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* localStorage not available */ }
  return 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('edutest_theme', newTheme);
    } catch { /* localStorage not available */ }

    // Limpiar cache de colores de charts
    clearColorCache();

    // Aplicar clase de transición temporal para cambio suave
    document.documentElement.classList.add('theme-transitioning');
    document.documentElement.setAttribute('data-theme', newTheme);
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 300);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Sincronizar tema inicial con el DOM (ya lo hizo el script inline, pero por si acaso)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally constrained
  }, []);

  // Escuchar cambios de tema desde otras pestañas
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'edutest_theme') {
        const newTheme = e.newValue === 'light' ? 'light' : 'dark';
        setThemeState(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}

export default ThemeContext;
