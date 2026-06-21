/**
 * Sparkline.jsx — Mini gráfico de líneas para KPIs
 * @param {number[]} values - Datos
 * @param {string} color - Color del stroke
 * @param {number} height - Altura en px
 */
import { useMemo, useId } from 'react';

export default function Sparkline({ values = [], color = 'var(--color-accent)', height = 36 }) {
  const id = useId();
  const w = 240;
  const h = height;

  const { path, area } = useMemo(() => {
    if (values.length < 2) return { path: '', area: '' };

    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return [x, y];
    });

    const pathStr = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
    return { path: pathStr, area: `${pathStr} L${w},${h} L0,${h} Z` };
  }, [values, w, h]);

  if (values.length < 2) return null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-auto">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
