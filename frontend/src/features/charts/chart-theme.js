// Read a resolved CSS custom property so SVG charts follow the active theme.
export function getComputedColor(varName, fallback = '#5b8cff') {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName)
  return v ? v.trim() : fallback
}

export const chartColors = () => ({
  accent: getComputedColor('--accent', '#5b8cff'),
  ok: getComputedColor('--ok', '#34d399'),
  warn: getComputedColor('--warn', '#fbbf24'),
  danger: getComputedColor('--danger', '#f87171'),
  line: getComputedColor('--line', '#283248'),
  fg2: getComputedColor('--fg-2', '#8995ab'),
})
