import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useSesion } from '../auth/sesion'
import { Boton, Cargando } from './ui'

const COMMIT = import.meta.env.VITE_COMMIT_SHA ?? 'local'

function SinAcceso({ titulo, detalle }: { titulo: string; detalle: string }) {
  const { cerrarSesion } = useSesion()
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-zinc-200">
        <h1 className="text-lg font-semibold text-zinc-900">{titulo}</h1>
        <p className="mt-2 text-sm text-zinc-600">{detalle}</p>
        <Boton variante="secundario" className="mt-5 w-full" onClick={() => void cerrarSesion()}>
          Cerrar sesión
        </Boton>
      </div>
    </main>
  )
}

/** Envoltorio de todas las páginas internas: exige una sesión del personal activa (HU-2). */
export default function Layout() {
  const { estado, personal, cerrarSesion } = useSesion()
  const location = useLocation()

  if (estado === 'cargando') return <Cargando />
  if (estado === 'sin_sesion') return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  if (estado === 'desactivado')
    return <SinAcceso titulo="Tu cuenta está desactivada" detalle="Habla con el administrador para volver a activarla." />
  if (estado === 'sin_ficha' || !personal)
    return (
      <SinAcceso
        titulo="Tu cuenta no tiene acceso"
        detalle="La cuenta existe, pero no está registrada como personal del gimnasio. Habla con el administrador."
      />
    )

  const enlace = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-orange-50 text-orange-700' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="text-sm font-bold tracking-tight">
            Workhard <span className="text-orange-600">Concón</span>
          </span>
          <nav className="flex gap-1">
            <NavLink to="/" end className={enlace}>
              Inicio
            </NavLink>
            {personal.rol === 'admin' && (
              <NavLink to="/personal" className={enlace}>
                Personal
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right text-xs leading-tight sm:block">
              <span className="block font-medium text-zinc-800">{personal.nombre}</span>
              <span className="text-zinc-500">{personal.rol === 'admin' ? 'Administrador' : 'Instructor'}</span>
            </span>
            <Boton variante="fantasma" onClick={() => void cerrarSesion()}>
              Salir
            </Boton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-6 text-xs text-zinc-400">Versión {COMMIT.slice(0, 7)}</footer>
    </div>
  )
}

/** Solo administradores. La base de datos igual lo exige por RLS. */
export function SoloAdmin({ children }: { children: React.ReactNode }) {
  const { personal } = useSesion()
  if (personal?.rol !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}
