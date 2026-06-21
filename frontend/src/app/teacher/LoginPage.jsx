/**
 * LoginPage.jsx — Login del docente (MD3)
 */
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../design-system';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showRecoverMsg, setShowRecoverMsg] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/teacher/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!credential.trim() || !password.trim()) {
      setError('Completa todos los campos');
      return;
    }

    setSubmitting(true);
    try {
      await login(credential.trim(), password);
      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg grid place-items-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-xl font-bold text-bg-1">
            E
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg-0">EduTest Pro</h1>
            <p className="text-xs text-fg-3">Plataforma de evaluación</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-bg-1 shadow-card rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-fg-0">Iniciar sesión</h2>
            <p className="text-sm text-fg-3 mt-1">Ingresa tus credenciales de docente</p>
          </div>

          <Input
            label="Correo o usuario"
            type="text"
            value={credential}
            onChange={e => setCredential(e.target.value)}
            placeholder="admin  o  docente@ejemplo.com"
            autoComplete="username"
          />

          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          {error && (
            <div className="bg-danger-soft border border-danger/20 text-danger text-sm px-4 py-3 rounded-xl" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? 'Validando…' : 'Ingresar'}
          </Button>

          <p className="text-center text-xs text-fg-3">
            ¿Olvidaste tu contraseña?{' '}
            <button
              type="button"
              className="text-accent hover:underline font-medium"
              onClick={() => setShowRecoverMsg(true)}
            >
              Recuperar
            </button>
          </p>
          {showRecoverMsg && (
            <div className="bg-accent-soft border border-accent/15 text-fg-1 text-sm px-4 py-3 rounded-xl">
              Contacta al administrador para recuperar tu contraseña.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
