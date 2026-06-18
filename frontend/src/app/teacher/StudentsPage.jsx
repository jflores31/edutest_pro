import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Search } from 'lucide-react'
import { api } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { PageHeader, Card, Input, Select, Center, Spinner, ErrorState, EmptyState } from '../../components/ui'
import { ScoreBadge } from '../../components/ScoreBadge'

export default function StudentsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [course, setCourse] = useState('')
  const { data, loading, error } = useApi(() => api.get('/students/'), [])
  const { data: coursesData } = useApi(() => api.get('/courses/'), [])

  const students = useMemo(() => data?.results || data || [], [data])
  const courses = coursesData?.results || coursesData || []

  const filtered = students.filter((s) => {
    const name = `${s.first_name || ''} ${s.last_name || ''} ${s.code || ''}`.toLowerCase()
    const matchesSearch = !search || name.includes(search.toLowerCase())
    const matchesCourse = !course || String(s.course) === course || String(s.course_id) === course
    return matchesSearch && matchesCourse
  })

  return (
    <>
      <PageHeader title="Estudiantes" subtitle="Gestiona estudiantes y su desempeño" />
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-2)' }} />
          <Input className="pl-9" placeholder="Buscar por nombre o código…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={course} onChange={(e) => setCourse(e.target.value)} className="max-w-xs">
          <option value="">Todos los cursos</option>
          {courses.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </Select>
      </div>

      {loading ? <Center><Spinner size={28} /></Center>
        : error ? <ErrorState error={error} />
          : filtered.length === 0 ? <EmptyState icon={Users} title="Sin estudiantes" hint="Importa estudiantes o créalos desde aquí." />
            : (
              <div className="flex flex-col gap-2">
                {filtered.map((s) => (
                  <Card key={s.id} className="flex cursor-pointer items-center justify-between gap-4 hover:-translate-y-0.5 transition-transform"
                    onClick={() => navigate(`/teacher/students/${s.id}`)}>
                    <div>
                      <p className="font-medium">{s.first_name} {s.last_name}</p>
                      <p className="text-xs" style={{ color: 'var(--fg-2)' }}>
                        {s.code} {s.course_name && `· ${s.course_name}`} · {s.attempts_count ?? 0} intentos
                      </p>
                    </div>
                    <ScoreBadge score={s.avg_score} />
                  </Card>
                ))}
              </div>
            )}
    </>
  )
}
