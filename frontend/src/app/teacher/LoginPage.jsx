import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, Field, Input } from '../../components/ui'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/teacher/dashboard', { replace: true })
  }, [user, navigate])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const me = await login(username, password)
      if (me) navigate('/teacher/dashboard', { replace: true })
      else setError('Credenciales inválidas.')
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--bg-0)' }}>
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <GraduationCap size={32} style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-semibold">EduTest Pro</h1>
          <p className="text-sm" style={{ color: 'var(--fg-2)' }}>Panel docente</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Usuario">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </Field>
          <Field label="Contraseña" error={error}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" loading={loading} className="mt-2">Ingresar</Button>
        </form>
      </Card>
    </div>
  )
}
