import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { PASS_THRESHOLD } from '../../components/ScoreBadge'

export default function StudentResultsPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const result = state?.result

  const score = result?.score ?? result?.score_20 ?? null
  const passed = score != null && Number(score) >= PASS_THRESHOLD

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--bg-0)' }}>
      <Card className="w-full max-w-sm text-center">
        {score == null ? (
          <>
            <CheckCircle2 size={48} className="mx-auto" style={{ color: 'var(--ok)' }} />
            <h1 className="mt-4 text-xl font-semibold">¡Examen entregado!</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--fg-2)' }}>
              Tu examen se registró correctamente. Tu docente publicará los resultados.
            </p>
          </>
        ) : (
          <>
            {passed
              ? <CheckCircle2 size={48} className="mx-auto" style={{ color: 'var(--ok)' }} />
              : <XCircle size={48} className="mx-auto" style={{ color: 'var(--danger)' }} />}
            <h1 className="mt-4 text-xl font-semibold">{passed ? '¡Aprobado!' : 'No aprobado'}</h1>
            <div className="mt-4 text-5xl font-bold" style={{ color: passed ? 'var(--ok)' : 'var(--danger)' }}>
              {Number(score).toFixed(1)}<span className="text-2xl" style={{ color: 'var(--fg-2)' }}>/20</span>
            </div>
          </>
        )}
        <Button variant="outline" className="mt-6" onClick={() => navigate(`/exam/${slug}`, { replace: true })}>
          Salir
        </Button>
      </Card>
    </div>
  )
}
