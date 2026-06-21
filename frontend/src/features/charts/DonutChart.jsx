/**
 * DonutChart.jsx — Gráfico de dona con leyenda interactiva
 * @param {number} pass - Aprobados
 * @param {number} fail - Reprobados
 * @param {number} abandoned - Abandonados
 * @param {function} onSegmentClick
 */
import { useState, useMemo } from 'react';

const COLORS = {
  pass: 'var(--color-ok)',
  fail: 'var(--color-warn)',
  abandoned: 'var(--color-fg-3)',
};

export default function DonutChart({ pass = 0, fail = 0, abandoned = 0, onSegmentClick }) {
  const [hovered, setHovered] = useState(null);

  const total = pass + fail + abandoned;

  const segments = useMemo(() => {
    if (total === 0) return [];
    return [
      { key: 'pass', label: 'Aprobados', value: pass, color: COLORS.pass, pct: Math.round((pass / total) * 100) },
      { key: 'fail', label: 'Reprobados', value: fail, color: COLORS.fail, pct: Math.round((fail / total) * 100) },
      { key: 'abandoned', label: 'Abandonados', value: abandoned, color: COLORS.abandoned, pct: Math.round((abandoned / total) * 100) },
    ].filter(s => s.value > 0);
  }, [pass, fail, abandoned, total]);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center gap-8 py-2">
        <svg width="100%" viewBox="0 0 170 170" style={{ maxWidth: 160, flexShrink: 0 }}>
          <circle cx="85" cy="85" r="56" fill="none" stroke="var(--color-bg-2)" strokeWidth="14" />
          <text x="85" y="78" textAnchor="middle" fill="var(--color-fg-3)" fontSize="24" fontWeight="700" fontFamily="Inter">
            0
          </text>
          <text x="85" y="92" textAnchor="middle" fill="var(--color-fg-3)" fontSize="9" fontFamily="Inter" letterSpacing="0.06em">
            INTENTOS
          </text>
        </svg>
        <div className="flex flex-col gap-3 min-w-[100px]">
          <div className="text-xs text-fg-3 leading-relaxed">
            Completa un examen<br />para ver estadísticas
          </div>
        </div>
      </div>
    );
  }
  const r = 56;
  const c = 2 * Math.PI * r;
  let offset = c / 4;

  const arcs = segments.map(seg => {
    const len = (seg.value / total) * c;
    const arc = { ...seg, len, offset };
    offset -= len;
    return arc;
  });

  return (
    <div className="flex items-center justify-center gap-8 py-2">
      <svg width="100%" viewBox="0 0 170 170" style={{ maxWidth: 160, flexShrink: 0 }}>
        <circle cx="85" cy="85" r={r} fill="none" stroke="var(--color-bg-2)" strokeWidth="14" />
        {arcs.map(arc => (
          <circle
            key={arc.key}
            cx="85"
            cy="85"
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={hovered === arc.key ? 16 : 14}
            strokeDasharray={`${arc.len} ${c}`}
            strokeDashoffset={arc.offset}
            transform="rotate(-90 85 85)"
            strokeLinecap="round"
            className="transition-all duration-300 ease-out cursor-pointer"
            onMouseEnter={() => setHovered(arc.key)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSegmentClick?.(arc.key)}
            style={{ opacity: hovered && hovered !== arc.key ? 0.5 : 1 }}
          />
        ))}
        <text x="85" y="73" textAnchor="middle" fill="var(--color-fg-0)" fontSize="28" fontWeight="700" fontFamily="Inter" style={{ letterSpacing: '-0.02em' }}>
          {total}
        </text>
        <text x="85" y="88" textAnchor="middle" fill="var(--color-fg-2)" fontSize="9" fontFamily="Inter" letterSpacing="0.06em">
          INTENTOS
        </text>
        <text x="85" y="102" textAnchor="middle" fill="var(--color-fg-3)" fontSize="10" fontFamily="Inter">
          {Math.round((pass / total) * 100)}% aprob.
        </text>
      </svg>

      <div className="flex flex-col gap-3 min-w-[100px]">
        {segments.map(seg => (
          <div
            key={seg.key}
            className={`cursor-pointer transition-opacity ${hovered && hovered !== seg.key ? 'opacity-50' : ''}`}
            onMouseEnter={() => setHovered(seg.key)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSegmentClick?.(seg.key)}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full" style={{ background: seg.color }} />
              <span className="text-xs text-fg-2">{seg.label}</span>
            </div>
            <div className="text-lg font-semibold text-fg-0 tabular-nums">{seg.value} <span className="text-sm font-normal text-fg-3">({seg.pct}%)</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
