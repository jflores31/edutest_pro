/**
 * BarChart.jsx — Gráfico de barras con tooltip y línea de umbral
 * @param {Array<{label: string, value: number}>} data
 * @param {number} threshold - Línea de umbral en unidades de maxValue
 * @param {number} maxValue  - Máximo del eje Y (default 20 para escala vigesimal)
 * @param {function} onBarClick
 */
import { useState } from 'react';

export default function BarChart({ data = [], threshold = 11, maxValue = 20, onBarClick }) {
  const [hovered, setHovered] = useState(null);

  const rotateLabels = data.length > 6;
  const W = 520;
  const H = 200;
  const pad = { l: 36, r: 36, t: 14, b: rotateLabels ? 62 : 38 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const barW = Math.min(40, innerW / Math.max(data.length, 1) / 2);
  const barGap = barW * 0.5;
  const totalBarsWidth = data.length * barW + (data.length - 1) * barGap;
  const barOffsetX = Math.max(0, (innerW - totalBarsWidth) / 2);

  // Y axis ticks relative to maxValue
  const yTicks = maxValue === 20
    ? [0, 5, 10, 15, 20]
    : [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Grid lines */}
      {yTicks.map(y => {
        const yPos = pad.t + innerH - (y / maxValue) * innerH;
        return (
          <g key={y}>
            <line x1={pad.l} x2={W - pad.r} y1={yPos} y2={yPos} stroke="var(--color-line)" strokeDasharray="2 4" />
            <text x={pad.l - 6} y={yPos + 3} fill="var(--color-fg-3)" fontSize="9" textAnchor="end" fontFamily="Inter">
              {maxValue === 20 ? y : `${y}%`}
            </text>
          </g>
        );
      })}

      {/* Baseline */}
      <line x1={pad.l} x2={W - pad.r} y1={pad.t + innerH} y2={pad.t + innerH}
        stroke="var(--color-line)" strokeWidth="1" />

      {/* Threshold line */}
      {threshold > 0 && (
        <line
          x1={pad.l} x2={W - pad.r}
          y1={pad.t + innerH - (threshold / maxValue) * innerH}
          y2={pad.t + innerH - (threshold / maxValue) * innerH}
          stroke="var(--color-ok)" strokeDasharray="4 4" strokeWidth="1" opacity="0.6"
        />
      )}

      {/* Bars */}
      {data.length > 0 ? data.map((d, i) => {
        const x = pad.l + barOffsetX + (barW + barGap) * i;
        const h = (Math.min(d.value, maxValue) / maxValue) * innerH;
        const y = pad.t + innerH - h;
        const color = d.value === 0
          ? 'var(--color-fg-3)'
          : d.value >= threshold ? 'var(--color-ok)' : 'var(--color-warn)';
        const isHovered = hovered === i;
        const labelX = x + barW / 2;
        const labelY = pad.t + innerH + 14;

        return (
          <g
            key={i}
            className="cursor-pointer"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onBarClick?.(d, i)}
          >
            <rect x={x} y={pad.t} width={barW} height={innerH} rx="3" fill={color} opacity={isHovered ? 0.1 : 0.06} />
            <rect x={x} y={y} width={barW} height={h} rx="3" fill={color} opacity={isHovered ? 1 : 0.9} />

            {/* Label — rotated when many bars */}
            <text
              x={labelX} y={labelY}
              fill="var(--color-fg-2)"
              fontSize={data.length > 10 ? "8" : "9"}
              textAnchor={rotateLabels ? 'end' : 'middle'}
              fontFamily="Inter"
              transform={rotateLabels ? `rotate(-35, ${labelX}, ${labelY})` : undefined}
            >
              {d.label.length > 16 ? d.label.slice(0, 14) + '…' : d.label}
            </text>

            {/* Value above bar */}
            {d.value > 0 && (
              <text
                x={x + barW / 2} y={y - 4}
                fill="var(--color-fg-0)"
                fontSize="10" textAnchor="middle"
                fontFamily="Inter" fontWeight="600"
              >
                {maxValue === 20 ? d.value : `${d.value}%`}
              </text>
            )}
          </g>
        );
      }) : (
        // Phantom bars — empty state
        <>
          {[0.15, 0.3, 0.2].map((frac, i) => {
            const x = pad.l + barOffsetX + (barW + barGap) * i;
            const h = frac * innerH;
            const y = pad.t + innerH - h;
            return (
              <rect key={i} x={x} y={y} width={barW} height={h} rx="4"
                fill="var(--color-bg-3)" opacity="0.5" />
            );
          })}
          <text x={W / 2} y={H / 2 + 4} textAnchor="middle" fill="var(--color-fg-3)"
            fontSize="12" fontFamily="Inter">
            Sin datos aún
          </text>
        </>
      )}
    </svg>
  );
}
