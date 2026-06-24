/**
 * BarChart.jsx — Barras HORIZONTALES (legibles para títulos largos) con umbral.
 * Título a la izquierda (truncado + tooltip del nombre completo), barra y valor a
 * la derecha. Sin rotación de etiquetas → sin solapamientos.
 * @param {Array<{label: string, value: number}>} data
 * @param {number} threshold - Umbral en unidades de maxValue (línea punteada)
 * @param {number} maxValue  - Máximo del eje (20 vigesimal / 100 %)
 * @param {function} onBarClick
 * @param {number} maxRows    - Máximo de filas visibles (default 8)
 */
import { useState } from 'react';

export default function BarChart({ data = [], threshold = 11, maxValue = 20, onBarClick, maxRows = 8 }) {
  const [hovered, setHovered] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[150px] text-sm text-fg-3">
        Sin datos aún
      </div>
    );
  }

  const rows = data.slice(0, maxRows);
  const extra = data.length - rows.length;
  const isPct = maxValue !== 20;
  const fmt = (v) => (isPct ? `${v}%` : `${Number(v).toFixed(1)}/20`);

  return (
    <div className="space-y-2.5">
      {rows.map((d, i) => {
        const pct = Math.max(0, Math.min(1, (d.value || 0) / maxValue));
        const color = d.value === 0
          ? 'var(--color-fg-3)'
          : d.value >= threshold ? 'var(--color-ok)' : 'var(--color-warn)';
        const isHovered = hovered === i;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 -mx-1 px-1 rounded-lg transition-colors ${onBarClick ? 'cursor-pointer' : ''} ${isHovered ? 'bg-bg-2/60' : ''}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onBarClick?.(d, i)}
          >
            {/* Título del examen (legible, completo en el tooltip) */}
            <span className="w-[38%] shrink-0 truncate text-xs text-fg-1" title={d.label}>
              {d.label}
            </span>

            {/* Pista + barra + marca de umbral */}
            <div className="relative flex-1 h-5 rounded-md bg-bg-2 overflow-hidden">
              {threshold > 0 && threshold < maxValue && (
                <span
                  className="absolute top-0 bottom-0 border-l border-dashed"
                  style={{ left: `${(threshold / maxValue) * 100}%`, borderColor: 'var(--color-ok)', opacity: 0.5 }}
                />
              )}
              <div
                className="h-full rounded-md transition-[width] duration-500"
                style={{ width: `${pct * 100}%`, background: color, opacity: isHovered ? 1 : 0.85 }}
              />
            </div>

            {/* Valor */}
            <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums text-fg-0">
              {d.value > 0 ? fmt(d.value) : '—'}
            </span>
          </div>
        );
      })}

      {extra > 0 && (
        <div className="pt-1 text-2xs text-fg-3">
          +{extra} examen{extra !== 1 ? 'es' : ''} más
        </div>
      )}
    </div>
  );
}
