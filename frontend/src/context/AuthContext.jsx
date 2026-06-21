import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.me()
      .then(data => {
        setUser(data);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (email, password) => {
    await auth.login(email, password);
    // Fetch user data before committing the logged-in state — if this fails
    // the user stays unauthenticated rather than entering a half-initialized state
    let userData;
    try {
      userData = await auth.me();
    } catch (err) {
      await auth.logout().catch(() => {});
      throw err;
    }
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      // Ignore logout errors — cookies will be cleared client-side anyway
    }
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export default AuthContext;