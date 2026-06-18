import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '../../components/ui'
import { Sparkline } from '../charts/charts'

export function KpiCard({ label, value, delta, sparkline, icon: Icon, onClick }) {
  const up = delta != null && delta >= 0
  return (
    <Card
      className={onClick ? 'cursor-pointer transition-transform hover:-translate-y-0.5' : ''}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm" style={{ color: 'var(--fg-2)' }}>{label}</span>
        {Icon && <Icon size={18} style={{ color: 'var(--fg-2)' }} />}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        {delta != null && (
          <span className="mb-1 inline-flex items-center gap-0.5 text-xs" style={{ color: up ? 'var(--ok)' : 'var(--danger)' }}>
            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="mt-3">
          <Sparkline values={sparkline} width={140} height={32} />
        </div>
      )}
    </Card>
  )
}
