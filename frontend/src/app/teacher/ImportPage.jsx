import { useState } from 'react'
import { Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { api } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { PageHeader, Card, Button, Badge, Center, Spinner } from '../../components/ui'

export default function ImportPage() {
  const toast = useToast()
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const d = await api.post('/imports/preview/', fd)
      setPreview(d)
    } catch (err) {
      toast.error(err?.message || 'No se pudo procesar el archivo')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const confirm = async () => {
    if (!preview) return
    setConfirming(true)
    try {
      const d = await api.post('/imports/confirm/', {
        draft_token: preview.draft_token,
        rows: preview.rows,
      })
      toast.success(`${d.questions_created} preguntas importadas`)
      setPreview(null)
    } catch (err) {
      toast.error(err?.message || 'No se pudo confirmar la importación')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <>
      <PageHeader title="Importar preguntas" subtitle="Carga un archivo CSV o XLSX" />
      <Card className="mb-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed py-10"
          style={{ borderColor: 'var(--line)' }}>
          <Upload size={28} style={{ color: 'var(--fg-2)' }} />
          <span className="text-sm" style={{ color: 'var(--fg-1)' }}>Haz clic para seleccionar un archivo</span>
          <span className="text-xs" style={{ color: 'var(--fg-2)' }}>CSV o XLSX · máx. 10 MB · 2000 filas</span>
          <input type="file" accept=".csv,.xlsx" className="hidden" onChange={onFile} />
        </label>
      </Card>

      {loading && <Center><Spinner size={28} /></Center>}

      {preview && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge tone="accent">{preview.total_rows} filas</Badge>
              {preview.error_count > 0
                ? <Badge tone="danger"><AlertTriangle size={13} /> {preview.error_count} con error</Badge>
                : <Badge tone="ok"><CheckCircle2 size={13} /> Sin errores</Badge>}
            </div>
            <Button onClick={confirm} loading={confirming} disabled={preview.total_rows === 0}>
              Importar {preview.total_rows - (preview.error_count || 0)} válidas
            </Button>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--fg-2)' }}>
                  <th className="py-1 pr-2">#</th><th className="py-1 pr-2">Pregunta</th><th className="py-1">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {(preview.rows || []).slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--line)' }}>
                    <td className="py-1 pr-2" style={{ color: 'var(--fg-2)' }}>{i + 1}</td>
                    <td className="py-1 pr-2">{r.question_text || r.text || '—'}</td>
                    <td className="py-1" style={{ color: 'var(--fg-2)' }}>{r.question_type || r.type || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
