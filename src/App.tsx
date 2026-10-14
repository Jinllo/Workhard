import { useEffect, useState } from 'react'
import { checkSupabase, supabaseSetup } from './lib/supabase'

type Status = { state: 'checking' } | { state: 'ok' | 'error'; detail: string }

const COMMIT = import.meta.env.VITE_COMMIT_SHA ?? 'local'

function useConnectionStatus(): Status {
  const [status, setStatus] = useState<Status>(
    supabaseSetup.ok ? { state: 'checking' } : { state: 'error', detail: supabaseSetup.error },
  )

  useEffect(() => {
    if (!supabaseSetup.ok) return
    let active = true
    checkSupabase(supabaseSetup.env).then((r) => {
      if (active) setStatus({ state: r.ok ? 'ok' : 'error', detail: r.detail })
    })
    return () => {
      active = false
    }
  }, [])

  return status
}

const BADGE = {
  checking: { dot: 'bg-amber-400', label: 'Verificando conexión…' },
  ok: { dot: 'bg-emerald-500', label: 'Conectado a Supabase' },
  error: { dot: 'bg-rose-500', label: 'Sin conexión' },
} as const

export default function App() {
  const status = useConnectionStatus()
  const badge = BADGE[status.state]

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900 flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Workhard Concón</p>
        <h1 className="mt-1 text-2xl font-bold">Gestión de clases</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Entorno de pruebas · Sprint 1. La agenda, los alumnos y los planes llegan en las próximas sesiones.
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200" role="status">
          <span className={`h-3 w-3 shrink-0 rounded-full ${badge.dot}`} aria-hidden />
          <div>
            <p className="text-sm font-medium">{badge.label}</p>
            {status.state !== 'checking' && <p className="text-xs text-zinc-500">{status.detail}</p>}
          </div>
        </div>

        <p className="mt-6 text-xs text-zinc-400">Versión {COMMIT.slice(0, 7)}</p>
      </section>
    </main>
  )
}
