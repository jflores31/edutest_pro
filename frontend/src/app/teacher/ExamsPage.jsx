import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Eye, Archive, Copy, Pencil } from 'lucide-react'
import { api } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { PageHeader, Card, Button, Badge, Center, Spinner, ErrorState, EmptyState } from '../../components/ui'

export default function ExamsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data, loading, error, reload } = useApi(() => api.get('/exams/'), [])

  const action = async (id, verb, label) => {
    try {
      await api.post(`/exams/${id}/${verb}/`)
      toast.success(label)
      reload()
    } catch (e) {
      toast.error(e?.message || 'Acción fallida')
    }
  }

  const duplicate = async (id) => {
    try {
      await api.post(`/exams/${id}/duplicate/`)
      toast.success('Examen duplicado')
      reload()
    } catch (e) {
      toast.error(e?.message || 'No se pudo duplicar')
    }
  }

  if (loading) return <Center><Spinner size={28} /></Center>
  if (error) return <ErrorState error={error} />

  const exams = data?.results || data || []

  return (
    <>
      <PageHeader
        title="Exámenes"
        subtitle="Crea, publica y gestiona tus evaluaciones"
        actions={<Button onClick={() => navigate('/teacher/exams/new')}><Plus size={16} /> Nuevo examen</Button>}
      />
      {exams.length === 0 ? (
        <EmptyState icon={FileText} title="Sin exámenes aún" hint="Crea tu primer examen para empezar."
          action={<Button className="mt-2" onClick={() => navigate('/teacher/exams/new')}><Plus size={16} /> Nuevo examen</Button>} />
      ) : (
        <div className="flex flex-col gap-3">
          {exams.map((ex) => (
            <Card key={ex.id} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{ex.title}</span>
                  {ex.archived ? <Badge tone="default">Archivado</Badge>
                    : ex.is_published ? <Badge tone="ok">Publicado</Badge>
                      : <Badge tone="warn">Borrador</Badge>}
                </div>
                <div className="mt-1 text-xs" style={{ color: 'var(--fg-2)' }}>
                  {(ex.questions_count ?? 0)} preguntas · {ex.duration_minutes ?? 0} min
                  {ex.pass_rate != null && ` · ${Math.round(ex.pass_rate)}% aprobación`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/teacher/exams/${ex.id}/edit`)}><Pencil size={15} /></Button>
                <Button size="sm" variant="ghost" onClick={() => duplicate(ex.id)}><Copy size={15} /></Button>
                {!ex.archived && (ex.is_published
                  ? <Button size="sm" variant="ghost" onClick={() => action(ex.id, 'unpublish', 'Despublicado')}><Eye size={15} /> Ocultar</Button>
                  : <Button size="sm" variant="outline" onClick={() => action(ex.id, 'publish', 'Publicado')}><Eye size={15} /> Publicar</Button>)}
                <Button size="sm" variant="ghost" onClick={() => action(ex.id, ex.archived ? 'unarchive' : 'archive', ex.archived ? 'Restaurado' : 'Archivado')}><Archive size={15} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
