import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSesion } from '../auth/sesion'
import { Aviso, Boton, Campo, Cargando } from '../components/ui'

export default function Login() {
  const { estado, iniciarSesion } = useSesion()
  const location = useLocation()
  const destino = (location.state as { desde?: string } | null)?.desde ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (estado === 'cargando') return <Cargando />
  if (estado === 'ok') return <Navigate to={destino} replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const mensaje = await iniciarSesion(email, password)
    setEnviando(false)
    if (mensaje) setError(mensaje)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-orange-600 uppercase">Workhard Concón</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Gestión de clases</h1>
          <p className="mt-1 text-sm text-zinc-500">Ingresa con tu cuenta del personal</p>
        </div>

        <form onSubmit={enviar} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <Campo
            etiqueta="Correo"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Campo
            etiqueta="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Boton type="submit" className="w-full" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Boton>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-400">Si olvidaste tu contraseña, habla con el administrador.</p>
      </div>
    </main>
  )
}
