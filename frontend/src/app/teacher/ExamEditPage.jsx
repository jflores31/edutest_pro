import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { PageHeader, Card, Field, Input, Textarea, Button, Center, Spinner } from '../../components/ui'

export default function ExamEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', duration_minutes: 60, max_attempts: 1 })

  useEffect(() => {
    if (!isEdit) return
    let active = true
    api.get(`/exams/${id}/`)
      .then((d) => { if (active) setForm({
        title: d.title || '',
        description: d.description || '',
        duration_minutes: d.duration_minutes ?? 60,
        max_attempts: d.max_attempts ?? 1,
      }) })
      .catch(() => toast.error('No se pudo cargar el examen'))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, isEdit, toast])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        duration_minutes: Number(form.duration_minutes),
        max_attempts: Number(form.max_attempts),
      }
      if (isEdit) {
        await api.patch(`/exams/${id}/`, payload)
        toast.success('Examen actualizado')
      } else {
        const created = await api.post('/exams/', payload)
        toast.success('Examen creado')
        navigate(`/teacher/exams/${created.id}/edit`, { replace: true })
      }
    } catch (err) {
      toast.error(err?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Center><Spinner size={28} /></Center>

  return (
    <>
      <PageHeader
        title={isEdit ? 'Editar examen' : 'Nuevo examen'}
        actions={<Button variant="ghost" onClick={() => navigate('/teacher/exams')}><ArrowLeft size={16} /> Volver</Button>}
      />
      <Card className="max-w-2xl">
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field label="Título"><Input value={form.title} onChange={set('title')} required autoFocus /></Field>
          <Field label="Descripción"><Textarea rows={3} value={form.description} onChange={set('description')} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Duración (minutos)"><Input type="number" min="1" value={form.duration_minutes} onChange={set('duration_minutes')} /></Field>
            <Field label="Intentos máximos"><Input type="number" min="1" value={form.max_attempts} onChange={set('max_attempts')} /></Field>
          </div>
          <Button type="submit" loading={saving} className="self-start">{isEdit ? 'Guardar cambios' : 'Crear examen'}</Button>
        </form>
      </Card>
    </>
  )
}
