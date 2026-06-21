/**
 * Heatmap.jsx — Grid de actividad por hora/día
 * @param {number[][]} data - Matriz 7xN de intensidades (0-4)
 * @param {string[]} days - Labels de días
 * @param {string[]} hours - Labels de horas
 * @param {function} onCellClick
 */
import { useState } from 'react';

const INTENSITIES = [
  'var(--color-bg-2)',
  'rgba(139,92,246,0.2)',
  'rgba(139,92,246,0.4)',
  'rgba(139,92,246,0.65)',
  'rgba(139,92,246,0.9)',
];

export default function Heatmap({
  data = [],
  days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  hours = ['8', '10', '12', '14', '16', '18', '20'],
  onCellClick,
}) {
  const [tooltip, setTooltip] = useState(null);
  const allInactive = data.length > 0 && data.every(row => row.every(v => v === 0));

  return (
    <div className="relative">
      {allInactive && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-xs text-fg-3 bg-bg-1/80 px-2 py-1 rounded">Sin actividad aún</span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {/* Header */}
        <div className="grid gap-1" style={{ gridTemplateColumns: `14px repeat(${hours.length}, 1fr)` }}>
          <span />
          {hours.map(h => (
            <div key={h} className="text-center text-2xs text-fg-3">{h}h</div>
          ))}
        </div>

        {/* Rows */}
        {days.map((day, di) => (
          <div key={day} className="grid gap-1 items-center" style={{ gridTemplateColumns: `14px repeat(${hours.length}, 1fr)` }}>
            <span className="text-xs text-fg-2">{day}</span>
            {(data[di] || []).map((v, hi) => (
              <div
                key={hi}
                className="h-[18px] rounded-[3px] cursor-pointer transition-transform hover:scale-110"
                style={{ background: INTENSITIES[v] || INTENSITIES[0] }}
                onMouseEnter={(e) => {
                  const rect = e.target.getBoundingClientRect();
                  setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, day, hour: hours[hi], intensity: v });
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => onCellClick?.(di, hi, v)}
              />
            ))}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-2 justify-end">
          <span className="text-2xs text-fg-3">Menos</span>
          {INTENSITIES.map((c, i) => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c }} />
          ))}
          <span className="text-2xs text-fg-3">Más</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 text-xs bg-bg-1 border border-line rounded-md shadow-pop pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <span className="text-fg-0 font-medium">{tooltip.day} {tooltip.hour}h</span>
          <span className="text-fg-2 ml-1">· {['Sin actividad', 'Baja', 'Media', 'Alta', 'Muy alta'][tooltip.intensity] || 'Sin datos'}</span>
        </div>
      )}
    </div>
  );
}
