import { Badge } from './ui'
import { PASS_THRESHOLD, isPassing } from '../utils/score'

// Vigesimal score 0–20. Umbral centralizado en utils/score.js.
export { PASS_THRESHOLD }

export function ScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return <Badge tone="default">—</Badge>
  }
  const value = Number(score)
  return (
    <Badge tone={isPassing(value) ? 'ok' : 'danger'}>
      {value.toFixed(1)}/20
    </Badge>
  )
}
