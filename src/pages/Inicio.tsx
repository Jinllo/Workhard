import { useSesion } from '../auth/sesion'
import { Tarjeta } from '../components/ui'
import { PERMISOS, tienePermiso } from '../lib/tipos'

export default function Inicio() {
  const { personal } = useSesion()
  if (!personal) return null
  const nombre = personal.nombre.split(' ')[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {nombre}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          La agenda del día, los alumnos y los planes se irán sumando en las próximas entregas.
        </p>
      </div>

      <Tarjeta>
        <h2 className="text-sm font-semibold text-zinc-900">Lo que puedes hacer con tu cuenta</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {PERMISOS.map((p) => {
            const si = tienePermiso(personal, p.clave)
            return (
              <li key={p.clave} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${si ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}
                  aria-hidden
                >
                  {si ? '✓' : '–'}
                </span>
                <span className={si ? 'text-zinc-800' : 'text-zinc-400'}>
                  {p.etiqueta}
                  <span className="sr-only">{si ? ': permitido' : ': no permitido'}</span>
                </span>
              </li>
            )
          })}
        </ul>
        {personal.rol !== 'admin' && (
          <p className="mt-4 text-xs text-zinc-500">Si necesitas otro permiso, pídeselo al administrador.</p>
        )}
      </Tarjeta>
    </div>
  )
}
