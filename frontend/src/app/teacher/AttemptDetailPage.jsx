import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X } from 'lucide-react'
import { api } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { PageHeader, Card, Button, Center, Spinner, ErrorState } from '../../components/ui'
import { ScoreBadge } from '../../components/ScoreBadge'

export default function AttemptDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, error } = useApi(() => api.get(`/attempts/${id}/detail/`), [id])

  if (loading) return <Center><Spinner size={28} /></Center>
  if (error) return <ErrorState error={error} />

  const a = data || {}
  const answers = a.answers || []

  return (
    <>
      <PageHeader
        title={a.exam_title || 'Intento'}
        subtitle={a.student_name || a.participant_name}
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Volver</Button>}
      />
      <Card className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs" style={{ color: 'var(--fg-2)' }}>Calificación</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-semibold">{a.score != null ? Number(a.score).toFixed(1) : '—'}</span>
            <ScoreBadge score={a.score} />
          </div>
        </div>
        <div className="text-right text-xs" style={{ color: 'var(--fg-2)' }}>
          {a.completed_at && <div>{new Date(a.completed_at).toLocaleString()}</div>}
          {a.time_spent_seconds != null && <div>{Math.round(a.time_spent_seconds / 60)} min</div>}
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {answers.map((ans, i) => (
          <Card key={i}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5">
                {ans.is_correct ? <Check size={18} style={{ color: 'var(--ok)' }} /> : <X size={18} style={{ color: 'var(--danger)' }} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i + 1}. {ans.question_text}</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--fg-1)' }}>
                  Respuesta: <span style={{ color: ans.is_correct ? 'var(--ok)' : 'var(--danger)' }}>{ans.student_answer ?? '—'}</span>
                </p>
                {!ans.is_correct && ans.correct_answer != null && (
                  <p className="text-sm" style={{ color: 'var(--fg-2)' }}>Correcta: {ans.correct_answer}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
