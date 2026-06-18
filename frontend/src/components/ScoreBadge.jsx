import { Badge } from './ui'

// Vigesimal score 0–20. Pass threshold is >= 11.
export const PASS_THRESHOLD = 11

export function ScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return <Badge tone="default">—</Badge>
  }
  const value = Number(score)
  const passed = value >= PASS_THRESHOLD
  return (
    <Badge tone={passed ? 'ok' : 'danger'}>
      {value.toFixed(1)}/20
    </Badge>
  )
}
