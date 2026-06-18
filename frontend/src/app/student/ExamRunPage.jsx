import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Clock, Send } from 'lucide-react'
import { studentApi, getStudentAttemptId, clearStudentSession } from '../../services/api'
import { Button, Card, Input, Center, Spinner } from '../../components/ui'

function fmt(s) {
  if (s == null) return '--:--'
  const m = Math.floor(s / 60), sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function ExamRunPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const attemptId = getStudentAttemptId()

  const [state, setState] = useState(null)
  const [answers, setAnswers] = useState({})
  const [remaining, setRemaining] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const saveTimers = useRef({})
  const submittedRef = useRef(false)

  // Load state
  useEffect(() => {
    if (!attemptId) { navigate(`/exam/${slug}`, { replace: true }); return }
    let active = true
    studentApi.state(attemptId)
      .then((s) => {
        if (!active) return
        if (s.status === 'COMPLETED') { navigate(`/exam/${slug}/results`, { replace: true }); return }
        setState(s)
        setAnswers(s.saved_answers || {})
        setRemaining(s.time_remaining_seconds)
      })
      .catch(() => navigate(`/exam/${slug}`, { replace: true }))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attemptId, slug, navigate])

  const submit = useCallback(async (auto = false) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      const result = await studentApi.finish(attemptId, {})
      clearStudentSession()
      navigate(`/exam/${slug}/results`, { replace: true, state: { result, auto } })
    } catch {
      submittedRef.current = false
      setSubmitting(false)
    }
  }, [attemptId, slug, navigate])

  // Timer + auto-submit
  useEffect(() => {
    if (remaining == null) return
    if (remaining <= 0) { submit(true); return }
    const t = setInterval(() => setRemaining((r) => (r != null ? r - 1 : r)), 1000)
    return () => clearInterval(t)
  }, [remaining, submit])

  // Heartbeat every 25s
  useEffect(() => {
    if (!attemptId) return
    const t = setInterval(() => { studentApi.heartbeat(attemptId).catch(() => {}) }, 25000)
    return () => clearInterval(t)
  }, [attemptId])

  const persist = useCallback((qid, answerData) => {
    clearTimeout(saveTimers.current[qid])
    saveTimers.current[qid] = setTimeout(() => {
      studentApi.saveAnswer(attemptId, { question_id: qid, answer_data: answerData }).catch(() => {})
    }, 600)
  }, [attemptId])

  const update = (qid, answerData) => {
    setAnswers((a) => ({ ...a, [qid]: answerData }))
    persist(qid, answerData)
  }

  if (loading) return <Center className="min-h-screen"><Spinner size={28} /></Center>
  if (!state) return null

  const questions = state.exam_snapshot?.questions || []
  const answeredCount = questions.filter((q) => {
    const a = answers[q.question_id]
    if (!a) return false
    return (a.selected_keys?.length) || a.value != null || (a.text && a.text.trim())
  }).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-0)' }}>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3"
        style={{ borderColor: 'var(--line)', background: 'var(--bg-1)' }}>
        <div>
          <h1 className="font-semibold">{state.exam_title}</h1>
          <p className="text-xs" style={{ color: 'var(--fg-2)' }}>{answeredCount}/{questions.length} respondidas</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-mono text-lg"
            style={{ color: remaining != null && remaining < 60 ? 'var(--danger)' : 'var(--fg-0)' }}>
            <Clock size={18} /> {fmt(remaining)}
          </span>
          <Button onClick={() => submit(false)} loading={submitting}><Send size={16} /> Entregar</Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        {questions.map((q, i) => (
          <Card key={q.question_id}>
            <p className="mb-3 font-medium">{i + 1}. {q.question_text}</p>
            <QuestionInput q={q} value={answers[q.question_id]} onChange={(v) => update(q.question_id, v)} />
          </Card>
        ))}
        <Button onClick={() => submit(false)} loading={submitting} size="lg" className="mt-2">
          <Send size={18} /> Entregar examen
        </Button>
      </main>
    </div>
  )
}

function QuestionInput({ q, value, onChange }) {
  const type = q.question_type
  if (type === 'MULTIPLE_CHOICE') {
    const options = q.metadata?.options || []
    const multiple = Boolean(q.metadata?.multiple)
    const selected = value?.selected_keys || []
    const toggle = (key) => {
      if (multiple) {
        const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]
        onChange({ selected_keys: next })
      } else {
        onChange({ selected_keys: [key] })
      }
    }
    return (
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const active = selected.includes(o.key)
          return (
            <button key={o.key} type="button" onClick={() => toggle(o.key)}
              className="flex items-center gap-3 rounded-[10px] border px-3 py-2 text-left text-sm"
              style={{
                borderColor: active ? 'var(--accent)' : 'var(--line)',
                background: active ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--bg-2)',
              }}>
              <span className="font-mono" style={{ color: 'var(--fg-2)' }}>{o.key}</span>
              <span>{o.text}</span>
            </button>
          )
        })}
      </div>
    )
  }
  if (type === 'TRUE_FALSE') {
    const val = value?.value
    return (
      <div className="flex gap-2">
        {[{ k: true, l: 'Verdadero' }, { k: false, l: 'Falso' }].map(({ k, l }) => (
          <button key={l} type="button" onClick={() => onChange({ value: k })}
            className="flex-1 rounded-[10px] border px-3 py-2 text-sm"
            style={{
              borderColor: val === k ? 'var(--accent)' : 'var(--line)',
              background: val === k ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--bg-2)',
            }}>
            {l}
          </button>
        ))}
      </div>
    )
  }
  // SHORT_ANSWER
  return (
    <Input value={value?.text || ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Tu respuesta…" />
  )
}
