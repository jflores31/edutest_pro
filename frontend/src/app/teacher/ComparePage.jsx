import { useState, useMemo } from 'react'
import { GitCompareArrows } from 'lucide-react'
import { api } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { PageHeader, Card, Button, Badge, Center, Spinner, EmptyState } from '../../components/ui'
import { Histogram } from '../../features/charts/charts'

export default function ComparePage() {
  const toast = useToast()
  const { data: examsData } = useApi(() => api.get('/exams/'), [])
  const exams = useMemo(() => examsData?.results || examsData || [], [examsData])
  const [selected, setSelected] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const compare = async () => {
    if (selected.length < 1) { toast.error('Selecciona al menos un examen'); return }
    setLoading(true)
    try {
      const d = await api.get(`/exams/compare/?ids=${selected.join(',')}`)
      setResult(d?.exams || d?.results || d || [])
    } catch (e) {
      toast.error(e?.message || 'No se pudo comparar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader title="Comparar exámenes" subtitle="Estadísticas lado a lado" />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          {exams.map((e) => (
            <button key={e.id} onClick={() => toggle(e.id)}
              className="rounded-full border px-3 py-1 text-sm"
              style={{
                borderColor: selected.includes(e.id) ? 'var(--accent)' : 'var(--line)',
                background: selected.includes(e.id) ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
                color: selected.includes(e.id) ? 'var(--accent)' : 'var(--fg-1)',
              }}>
              {e.title}
            </button>
          ))}
        </div>
        <Button className="mt-4" onClick={compare} disabled={selected.length === 0}>Comparar ({selected.length})</Button>
      </Card>

      {loading ? <Center><Spinner size={28} /></Center>
        : !result ? <EmptyState icon={GitCompareArrows} title="Sin comparación" hint="Selecciona exámenes y pulsa Comparar." />
          : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {result.map((r) => (
                <Card key={r.id || r.exam_id}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-medium">{r.title}</h3>
                    {r.pass_rate != null && <Badge tone={r.pass_rate >= 50 ? 'ok' : 'warn'}>{Math.round(r.pass_rate)}% aprob.</Badge>}
                  </div>
                  <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div><div className="text-xs" style={{ color: 'var(--fg-2)' }}>Intentos</div><div className="font-semibold">{r.total ?? r.attempts ?? 0}</div></div>
                    <div><div className="text-xs" style={{ color: 'var(--fg-2)' }}>Promedio</div><div className="font-semibold">{r.avg != null ? Number(r.avg).toFixed(1) : '—'}</div></div>
                    <div><div className="text-xs" style={{ color: 'var(--fg-2)' }}>Aprob.</div><div className="font-semibold">{r.pass_rate != null ? `${Math.round(r.pass_rate)}%` : '—'}</div></div>
                  </div>
                  {r.distribution && <Histogram data={r.distribution} height={140} />}
                </Card>
              ))}
            </div>
          )}
    </>
  )
}
