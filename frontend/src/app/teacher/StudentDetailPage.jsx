import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { PageHeader, Card, Button, Center, Spinner, ErrorState } from '../../components/ui'
import { ScoreBadge } from '../../components/ScoreBadge'
import { BarChart } from '../../features/charts/charts'

export default function StudentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, error } = useApi(() => api.get(`/students/${id}/profile/`), [id])

  if (loading) return <Center><Spinner size={28} /></Center>
  if (error) return <ErrorState error={error} />

  const s = data || {}
  const topicStats = (s.topic_stats || []).map((t) => ({
    label: t.topic,
    value: t.total ? Math.round((t.correct / t.total) * 100) : 0,
  }))
  const attempts = s.attempts || []

  return (
    <>
      <PageHeader
        title={`${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Estudiante'}
        subtitle={`${s.code || ''}${s.course_name ? ` · ${s.course_name}` : ''}`}
        actions={<Button variant="ghost" onClick={() => navigate('/teacher/students')}><ArrowLeft size={16} /> Volver</Button>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><div className="text-xs" style={{ color: 'var(--fg-2)' }}>Promedio</div><div className="mt-1 text-2xl font-semibold">{s.avg_score != null ? Number(s.avg_score).toFixed(1) : '—'}</div></Card>
        <Card><div className="text-xs" style={{ color: 'var(--fg-2)' }}>Intentos</div><div className="mt-1 text-2xl font-semibold">{s.attempts_count ?? attempts.length}</div></Card>
        <Card><div className="text-xs" style={{ color: 'var(--fg-2)' }}>Ranking</div><div className="mt-1 text-2xl font-semibold">{s.ranking != null ? `#${s.ranking}` : '—'}</div></Card>
      </div>

      {topicStats.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-4 text-sm font-medium" style={{ color: 'var(--fg-1)' }}>Aciertos por tema (%)</h2>
          <BarChart data={topicStats} />
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="mb-4 text-sm font-medium" style={{ color: 'var(--fg-1)' }}>Intentos</h2>
        {attempts.length === 0 ? <p className="text-sm" style={{ color: 'var(--fg-2)' }}>Sin intentos completados.</p>
          : (
            <div className="flex flex-col gap-2">
              {attempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b pb-2 last:border-0" style={{ borderColor: 'var(--line)' }}>
                  <div>
                    <p className="text-sm">{a.exam_title}</p>
                    <p className="text-xs" style={{ color: 'var(--fg-2)' }}>{a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={a.score} />
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/teacher/attempts/${a.id}`)}>Ver</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </Card>
    </>
  )
}
