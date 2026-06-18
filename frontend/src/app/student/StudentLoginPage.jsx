import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GraduationCap, ArrowRight } from 'lucide-react'
import { studentApi, setStudentToken, setStudentAttemptId } from '../../services/api'
import { Button, Card, Field, Input } from '../../components/ui'

export default function StudentLoginPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [student, setStudent] = useState(null) // confirmation step
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const lookup = async (e) => {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const s = await studentApi.lookup(slug, code.trim())
      setStudent(s)
    } catch (err) {
      setError(err?.message || 'No se encontró el estudiante.')
    } finally {
      setLoading(false)
    }
  }

  const start = async () => {
    setError(null); setLoading(true)
    try {
      const res = await studentApi.login(slug, code.trim())
      setStudentToken(res.attempt_token)
      setStudentAttemptId(res.attempt_id)
      navigate(`/exam/${slug}/run`, { replace: true })
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar el examen.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--bg-0)' }}>
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <GraduationCap size={32} style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-semibold">EduTest Pro</h1>
          <p className="text-sm" style={{ color: 'var(--fg-2)' }}>Acceso a examen</p>
        </div>

        {!student ? (
          <form onSubmit={lookup} className="flex flex-col gap-4">
            <Field label="Código de estudiante" error={error} hint="El código que te dio tu docente">
              <Input value={code} onChange={(e) => setCode(e.target.value)} autoFocus required />
            </Field>
            <Button type="submit" loading={loading} className="mt-1">
              Continuar <ArrowRight size={16} />
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-[10px] border p-4 text-center" style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}>
              <p className="text-sm" style={{ color: 'var(--fg-2)' }}>¿Eres tú?</p>
              <p className="mt-1 text-lg font-semibold">{student.first_name} {student.last_name}</p>
            </div>
            {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
            <Button onClick={start} loading={loading}>Comenzar examen</Button>
            <Button variant="ghost" onClick={() => { setStudent(null); setError(null) }}>No soy yo</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
