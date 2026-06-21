/**
 * Histogram.jsx — Distribución de notas
 * @param {Array<{range: string, count: number, color: string}>} buckets
 */
export default function Histogram({ buckets = [] }) {
  const max = Math.max(...buckets.map(b => b.count), 1);
  const allEmpty = buckets.length === 0 || buckets.every(b => b.count === 0);
  const displayBuckets = allEmpty
    ? [
        { range: '0-20', count: 0, color: 'var(--color-bg-3)' },
        { range: '20-40', count: 0, color: 'var(--color-bg-3)' },
        { range: '40-60', count: 0, color: 'var(--color-bg-3)' },
        { range: '60-80', count: 0, color: 'var(--color-bg-3)' },
        { range: '80-100', count: 0, color: 'var(--color-bg-3)' },
      ]
    : buckets;

  return (
    <div className="flex items-end gap-3 h-[130px] pt-1 relative">
      {displayBuckets.map(b => (
        <div key={b.range} className="flex-1 flex flex-col items-center gap-1.5" style={{ minWidth: 36, maxWidth: 72 }}>
          <div
            className="w-full rounded-t transition-all duration-300"
            style={{
              height: allEmpty ? '12px' : `${(b.count / max) * 80}px`,
              background: b.color,
              opacity: allEmpty ? 0.4 : 0.9,
              minHeight: b.count > 0 ? '4px' : '0',
            }}
          />
          <div className="text-xs text-fg-1 font-semibold tabular-nums">{b.count || 0}</div>
          <div className="text-2xs text-fg-2">{b.range}</div>
        </div>
      ))}
      {allEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-fg-3 bg-bg-1/80 px-2 py-1 rounded">Sin datos aún</span>
        </div>
      )}
    </div>
  );
}
