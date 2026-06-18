import { chartColors } from './chart-theme'

export function ChartSkeleton({ height = 180 }) {
  return (
    <div
      className="w-full animate-pulse rounded-[10px]"
      style={{ height, background: 'var(--bg-2)' }}
      aria-hidden
    />
  )
}

// data: [{ label, value }]
export function BarChart({ data = [], height = 200, color }) {
  const c = chartColors()
  const bar = color || c.accent
  const max = Math.max(1, ...data.map((d) => d.value))
  if (!data.length) return <ChartSkeleton height={height} />
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
          <div className="text-xs" style={{ color: 'var(--fg-2)' }}>{d.value}</div>
          <div
            className="w-full rounded-t-[6px]"
            style={{ height: `${(d.value / max) * (height - 40)}px`, background: bar, minHeight: 2 }}
            title={`${d.label}: ${d.value}`}
          />
          <div className="truncate text-[11px]" style={{ color: 'var(--fg-2)', maxWidth: '100%' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

// data: [{ label, value, color? }]
export function DonutChart({ data = [], size = 160, thickness = 22 }) {
  const c = chartColors()
  const palette = [c.accent, c.ok, c.warn, c.danger, c.fg2]
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2
  const cir = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.map((d, i) => {
            const frac = d.value / total
            const dash = frac * cir
            const seg = (
              <circle
                key={i}
                cx={size / 2} cy={size / 2} r={r}
                fill="none"
                stroke={d.color || palette[i % palette.length]}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${cir - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return seg
          })}
        </g>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" style={{ fill: 'var(--fg-0)', fontSize: 20, fontWeight: 600 }}>
          {total}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: d.color || palette[i % palette.length] }} />
            <span style={{ color: 'var(--fg-1)' }}>{d.label}</span>
            <span style={{ color: 'var(--fg-2)' }}>({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// data: [{ range, count }]
export function Histogram({ data = [], height = 200 }) {
  return <BarChart data={data.map((d) => ({ label: d.range, value: d.count }))} height={height} />
}

// values: number[]  — compact trend line
export function Sparkline({ values = [], width = 120, height = 36, color }) {
  const c = chartColors()
  const stroke = color || c.accent
  if (values.length < 2) return <svg width={width} height={height} />
  const max = Math.max(...values), min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / span) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height}>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// grid: number[][] (rows of intensity 0..max), optional xLabels/yLabels
export function Heatmap({ grid = [], xLabels = [], yLabels = [] }) {
  const c = chartColors()
  const max = Math.max(1, ...grid.flat())
  if (!grid.length) return <ChartSkeleton height={160} />
  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 3 }}>
        <tbody>
          {grid.map((row, y) => (
            <tr key={y}>
              {yLabels[y] && <td className="pr-2 text-right text-[11px]" style={{ color: 'var(--fg-2)' }}>{yLabels[y]}</td>}
              {row.map((val, x) => (
                <td key={x}>
                  <div
                    title={`${val}`}
                    style={{
                      width: 22, height: 22, borderRadius: 4,
                      background: `color-mix(in srgb, ${c.accent} ${Math.round((val / max) * 100)}%, var(--bg-2))`,
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
          {xLabels.length > 0 && (
            <tr>
              {yLabels.length > 0 && <td />}
              {xLabels.map((l, i) => (
                <td key={i} className="text-center text-[10px]" style={{ color: 'var(--fg-2)' }}>{l}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
