import { useState, useMemo } from 'react'
import { Library, Search } from 'lucide-react'
import { api } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { PageHeader, Card, Input, Select, Badge, Center, Spinner, ErrorState, EmptyState } from '../../components/ui'

const TYPE_LABELS = {
  MULTIPLE_CHOICE: 'Opción múltiple',
  TRUE_FALSE: 'Verdadero/Falso',
  SHORT_ANSWER: 'Respuesta corta',
}

export default function BankPage() {
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const { data, loading, error } = useApi(() => api.get('/questions/'), [])

  const questions = useMemo(() => data?.results || data || [], [data])
  const topics = useMemo(
    () => [...new Set(questions.map((q) => q.topic).filter(Boolean))],
    [questions],
  )

  const filtered = questions.filter((q) => {
    const matchesSearch = !search || (q.question_text || '').toLowerCase().includes(search.toLowerCase())
    const matchesTopic = !topic || q.topic === topic
    return matchesSearch && matchesTopic
  })

  return (
    <>
      <PageHeader title="Banco de preguntas" subtitle="Preguntas reutilizables de tu organización" />
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-2)' }} />
          <Input className="pl-9" placeholder="Buscar preguntas…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={topic} onChange={(e) => setTopic(e.target.value)} className="max-w-xs">
          <option value="">Todos los temas</option>
          {topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </div>

      {loading ? <Center><Spinner size={28} /></Center>
        : error ? <ErrorState error={error} />
          : filtered.length === 0 ? <EmptyState icon={Library} title="Sin preguntas" hint="Importa o crea preguntas para llenar el banco." />
            : (
              <div className="flex flex-col gap-2">
                {filtered.map((q) => (
                  <Card key={q.id} className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate">{q.question_text}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: 'var(--fg-2)' }}>
                        {q.topic && <Badge tone="accent">{q.topic}</Badge>}
                        <span>{TYPE_LABELS[q.question_type] || q.question_type}</span>
                        {q.usage_count != null && <span>· usada {q.usage_count}×</span>}
                        {q.error_rate != null && <span>· {Math.round(q.error_rate)}% error</span>}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
    </>
  )
}
