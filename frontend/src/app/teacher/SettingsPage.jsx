import { useState } from 'react'
import { api, authApi } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { PageHeader, Card, Field, Input, Button, Badge } from '../../components/ui'

export default function SettingsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [saving, setSaving] = useState(false)
  const { data: integrations, reload } = useApi(() => api.get('/integrations/'), [])

  const changePassword = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await authApi.changePassword(oldPw, newPw)
      toast.success('Contraseña actualizada')
      setOldPw(''); setNewPw('')
    } catch (err) {
      toast.error(err?.message || 'No se pudo cambiar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  const toggleIntegration = async (key) => {
    try {
      await api.post(`/integrations/${key}/toggle/`)
      reload()
    } catch (err) {
      toast.error(err?.message || 'No se pudo cambiar la integración')
    }
  }

  const items = integrations?.results || integrations || []

  return (
    <>
      <PageHeader title="Ajustes" subtitle={`${user?.username} · ${user?.role}`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-medium" style={{ color: 'var(--fg-1)' }}>Cambiar contraseña</h2>
          <form onSubmit={changePassword} className="flex flex-col gap-3">
            <Field label="Contraseña actual">
              <Input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} required />
            </Field>
            <Field label="Nueva contraseña">
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
            </Field>
            <Button type="submit" loading={saving} className="mt-1 self-start">Guardar</Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-medium" style={{ color: 'var(--fg-1)' }}>Integraciones</h2>
          {items.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--fg-2)' }}>No hay integraciones disponibles.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((it) => (
                <div key={it.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{it.name || it.key}</span>
                    {it.connected ? <Badge tone="ok">Conectado</Badge> : <Badge>Desconectado</Badge>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => toggleIntegration(it.key)}>
                    {it.connected ? 'Desconectar' : 'Conectar'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
