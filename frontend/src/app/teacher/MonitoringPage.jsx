import { useState, useEffect, useMemo } from 'react'
import { Activity, RadioTower } from 'lucide-react'
import { api } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { PageHeader, Card, Select, Badge, Center, Spinner, EmptyState } from '../../components/ui'

export default function MonitoringPage() {
  const { data: examsData } = useApi(() => api.get('/exams/'), [])
  const exams = useMemo(() => (examsData?.results || examsData || []).filter((e) => e.is_published), [examsData])
  const [examId, setExamId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!examId) { setRows([]); return }
    let active = true
    const fetchData = async () => {
      try {
        const d = await api.get(`/exams/${examId}/monitoring/`)
        if (active) setRows(d?.attempts || d?.results || d || [])
      } catch { /* ignore transient */ }
      finally { if (active) setLoading(false) }
    }
    setLoading(true)
    fetchData()
    const t = setInterval(fetchData, 15000) // live poll, matches backend live view
    return () => { active = false; clearInterval(t) }
  }, [examId])

  return (
    <>
      <PageHeader title="Monitoreo en vivo" subtitle="Intentos en progreso, actualizado cada 15 s"
        actions={<Badge tone="accent"><RadioTower size={13} /> En vivo</Badge>} />
      <Select value={examId} onChange={(e) => setExamId(e.target.value)} className="mb-4 max-w-sm">
        <option value="">Selecciona un examen publicado…</option>
        {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
      </Select>

      {!examId ? <EmptyState icon={Activity} title="Selecciona un examen" hint="Verás los intentos activos en tiempo real." />
        : loading && rows.length === 0 ? <Center><Spinner size={28} /></Center>
          : rows.length === 0 ? <EmptyState icon={Activity} title="Sin intentos activos" hint="Nadie está rindiendo este examen ahora." />
            : (
              <div className="flex flex-col gap-2">
                {rows.map((r) => (
                  <Card key={r.id} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{r.student_name || r.participant_name || '—'}</p>
                      <p className="text-xs" style={{ color: 'var(--fg-2)' }}>
                        {(r.answered ?? r.progress ?? 0)}/{r.total ?? r.questions_count ?? '?'} respondidas
                        {r.last_heartbeat && ` · activo`}
                      </p>
                    </div>
                    <Badge tone={r.last_heartbeat ? 'ok' : 'warn'}>{r.last_heartbeat ? 'En línea' : 'Inactivo'}</Badge>
                  </Card>
                ))}
              </div>
            )}
    </>
  )
}
