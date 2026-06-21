/**
 * chart-theme.js — Resuelve variables CSS a valores hex en tiempo de ejecución.
 * Necesario para librerías como Recharts que requieren hex/rgb en lugar de var(--color-*).
 *
 * El cache se invalida automáticamente al cambiar de tema.
 */

let _lastTheme = null;
const _cache = new Map();

function _getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function getComputedColor(varName) {
  if (typeof window === 'undefined') return '#000000';

  const currentTheme = _getCurrentTheme();

  // Invalidar cache si cambió el tema
  if (_lastTheme !== currentTheme) {
    _cache.clear();
    _lastTheme = currentTheme;
  }

  if (_cache.has(varName)) return _cache.get(varName);

  const raw = varName.startsWith('var(')
    ? varName.replace(/^var\(/, '').replace(/\)$/, '').trim()
    : varName;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(raw)
    .trim();

  const result = value || varName;
  _cache.set(varName, result);
  return result;
}

export function clearColorCache() {
  _cache.clear();
  _lastTheme = null;
}

export const THEME = {
  ok:      () => getComputedColor('--color-ok'),
  warn:    () => getComputedColor('--color-warn'),
  danger:  () => getComputedColor('--color-danger'),
  accent:  () => getComputedColor('--color-accent'),
  fg0:     () => getComputedColor('--color-fg-0'),
  fg2:     () => getComputedColor('--color-fg-2'),
  fg3:     () => getComputedColor('--color-fg-3'),
  bg2:     () => getComputedColor('--color-bg-2'),
  line:    () => getComputedColor('--color-line'),
};
