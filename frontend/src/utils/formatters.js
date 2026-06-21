/**
 * formatters.js — Utilidades de formato compartidas
 * Fuente única de verdad para toda la app.
 */

export function formatRelative(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'ayer';
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export function formatDuration(startedAt, completedAt) {
  if (!startedAt || !completedAt) return '—';
  const mins = Math.round((new Date(completedAt) - new Date(startedAt)) / 60000);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
