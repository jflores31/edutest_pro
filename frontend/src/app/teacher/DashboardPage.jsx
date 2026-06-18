import { Users, FileText, CheckCircle2, Percent } from 'lucide-react'
import { api } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { PageHeader, Card, Center, Spinner, ErrorState } from '../../components/ui'
import { KpiCard } from '../../features/dashboard/KpiCard'
import { BarChart, DonutChart, ChartSkeleton } from '../../features/charts/charts'

export default function DashboardPage() {
  const { data, loading, error } = useApi(() => api.get('/dashboard/'), [])

  if (loading) return <Center><Spinner size={28} /></Center>
  if (error) return <ErrorState error={error} />

  const d = data || {}
  const passDist = [
    { label: 'Aprobados', value: d.passed_count ?? 0, color: 'var(--ok)' },
    { label: 'Desaprobados', value: d.failed_count ?? 0, color: 'var(--danger)' },
  ]
  const byExam = (d.attempts_by_exam || d.exams_activity || []).map((x) => ({
    label: x.title || x.label || '—',
    value: x.count ?? x.attempts ?? 0,
  }))

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen de actividad de tu organización" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Estudiantes" value={d.students_count ?? 0} icon={Users} />
        <KpiCard label="Exámenes" value={d.exams_count ?? 0} icon={FileText} />
        <KpiCard label="Intentos completados" value={d.completed_attempts ?? d.attempts_count ?? 0} icon={CheckCircle2} />
        <KpiCard
          label="Promedio (0–20)"
          value={d.avg_score != null ? Number(d.avg_score).toFixed(1) : '—'}
          icon={Percent}
          sparkline={d.score_trend}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-medium" style={{ color: 'var(--fg-1)' }}>Aprobación</h2>
          {loading ? <ChartSkeleton /> : <DonutChart data={passDist} />}
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium" style={{ color: 'var(--fg-1)' }}>Intentos por examen</h2>
          {byExam.length ? <BarChart data={byExam} /> : <ChartSkeleton />}
        </Card>
      </div>
    </>
  )
}
