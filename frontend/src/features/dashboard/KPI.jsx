import { useCountUp } from '../../hooks/useCountUp';
import { Card, Icon } from '../../design-system';

export function DeltaBadge({ value, invert = false }) {
  if (value == null || value === 0) return null;
  const positive = invert ? value < 0 : value > 0;
  return (
    <span className={`text-2xs font-semibold tabular-nums ${positive ? 'text-ok' : 'text-danger'}`}>
      {value > 0 ? '↑' : '↓'} {Math.abs(value).toFixed(1)}
    </span>
  );
}

export function KPICard({ icon, label, value, suffix, foot, delta, invertDelta, loading }) {
  const decimals = value != null && String(value).includes('.') ? 1 : 0;
  const animated = useCountUp(Number(value) || 0, { decimals });

  if (loading) {
    return (
      <Card padding="md" variant="elevated" className="relative overflow-hidden">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-bg-3 rounded-xl animate-pulse" />
          <div className="h-7 w-16 bg-bg-3 rounded-xl animate-pulse" />
          <div className="h-3 w-20 bg-bg-3 rounded-xl animate-pulse" />
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" variant="elevated" className="relative overflow-hidden">
      <div className="flex items-center gap-2.5 text-fg-2 mb-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft">
          <Icon name={icon} size={16} strokeWidth={1.8} className="text-accent" />
        </div>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
        <span className="text-2xl font-bold text-fg-0 tabular-nums">
          {value != null ? (decimals > 0 ? animated.toFixed(decimals) : animated) : '—'}
        </span>
        {suffix && <span className="text-sm text-fg-3">{suffix}</span>}
        <DeltaBadge value={delta} invert={invertDelta} />
      </div>
      {foot && <div className="text-2xs text-fg-3 mt-1">{foot}</div>}
    </Card>
  );
}
