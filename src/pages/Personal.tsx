import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSesion } from '../auth/sesion'
import { Aviso, Boton, Campo, Cargando, Interruptor, Tarjeta } from '../components/ui'
import { invocarFuncion, supabase } from '../lib/supabase'
import { PERMISOS, type Personal as Ficha, type Rol } from '../lib/tipos'

const COLUMNAS =
  'id, nombre, email, rol, puede_crear_alumnos, puede_asignar_planes, puede_extender, puede_editar_grilla, activo'

function generarContrasena(): string {
  const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => letras[b % letras.length]).join('')
}

type Mensaje = { tipo: 'error' | 'exito'; texto: string } | null

function NuevaCuenta({ alCrear }: { alCrear: (aviso: string) => void }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generarContrasena)
  const [rol, setRol] = useState<Rol>('instructor')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function crear(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const r = await invocarFuncion<{ id: string }>('gestionar-personal', { accion: 'crear', nombre, email, password, rol })
    setEnviando(false)
    if (r.error) return setError(r.error)
    alCrear(`Cuenta creada para ${nombre}. Entrégale su correo (${email.trim().toLowerCase()}) y la contraseña inicial: ${password}`)
    setNombre('')
    setEmail('')
    setPassword(generarContrasena())
    setRol('instructor')
  }

  return (
    <Tarjeta>
      <h2 className="text-base font-semibold">Nueva cuenta</h2>
      <p className="mt-1 text-sm text-zinc-500">
        La persona entra con este correo y la contraseña inicial. No se envía ningún correo.
      </p>
      <form onSubmit={crear} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Campo etiqueta="Correo" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex items-end gap-2">
          <Campo
            className="flex-1"
            etiqueta="Contraseña inicial"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            ayuda="Mínimo 8 caracteres."
          />
          <Boton type="button" variante="secundario" className="mb-5" onClick={() => setPassword(generarContrasena())}>
            Generar
          </Boton>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Rol</span>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            className="mt-1 block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-zinc-300 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <option value="instructor">Instructor</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        {error && (
          <div className="sm:col-span-2">
            <Aviso tipo="error">{error}</Aviso>
          </div>
        )}
        <div className="sm:col-span-2">
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear cuenta'}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

export default function Personal() {
  const { personal: yo, recargar } = useSesion()
  const [lista, setLista] = useState<Ficha[] | null>(null)
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  // Pide recargar la lista; el efecto de abajo hace la consulta.
  const cargar = useCallback(async () => setVersion((v) => v + 1), [])

  useEffect(() => {
    let vigente = true
    supabase()
      .from('personal')
      .select(COLUMNAS)
      .order('rol')
      .order('nombre')
      .then(({ data, error }) => {
        if (!vigente) return
        if (error) setMensaje({ tipo: 'error', texto: 'No se pudo cargar el personal.' })
        setLista((data as Ficha[] | null) ?? [])
      })
    return () => {
      vigente = false
    }
  }, [version])

  async function cambiarPermiso(ficha: Ficha, columna: keyof Ficha, valor: boolean) {
    setOcupado(ficha.id)
    setMensaje(null)
    setLista((l) => l?.map((x) => (x.id === ficha.id ? { ...x, [columna]: valor } : x)) ?? null)
    const { error } = await supabase()
      .from('personal')
      .update({ [columna]: valor })
      .eq('id', ficha.id)
    if (error) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el permiso.' })
      await cargar()
    }
    if (ficha.id === yo?.id) await recargar()
    setOcupado(null)
  }

  async function cambiarEstado(ficha: Ficha) {
    const activar = !ficha.activo
    const pregunta = activar
      ? `¿Reactivar la cuenta de ${ficha.nombre}?`
      : `¿Desactivar la cuenta de ${ficha.nombre}? No podrá iniciar sesión hasta que la reactives.`
    if (!window.confirm(pregunta)) return
    setOcupado(ficha.id)
    setMensaje(null)
    const r = await invocarFuncion('gestionar-personal', { accion: 'cambiar_estado', id: ficha.id, activo: activar })
    setMensaje(
      r.error
        ? { tipo: 'error', texto: r.error }
        : { tipo: 'exito', texto: `Cuenta de ${ficha.nombre} ${activar ? 'reactivada' : 'desactivada'}.` },
    )
    await cargar()
    setOcupado(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Personal</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Cuentas del personal y sus permisos. Los cambios aplican en la siguiente acción de la persona.
        </p>
      </div>

      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}

      <Tarjeta className="overflow-hidden p-0 sm:p-0">
        {lista === null ? (
          <Cargando />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Persona</th>
                  {PERMISOS.map((p) => (
                    <th key={p.clave} className="px-3 py-3 text-center font-medium">
                      {p.etiqueta}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {lista.map((f) => {
                  const esAdmin = f.rol === 'admin'
                  return (
                    <tr key={f.id} className={f.activo ? '' : 'bg-zinc-50 text-zinc-400'}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">
                          {f.nombre}
                          {f.id === yo?.id && <span className="ml-1 text-xs font-normal text-zinc-400">(tú)</span>}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {esAdmin ? 'Administrador' : 'Instructor'}
                          {f.email ? ` · ${f.email}` : ''}
                        </div>
                      </td>
                      {PERMISOS.map((p) => (
                        <td key={p.clave} className="px-3 py-3 text-center">
                          <div className="flex justify-center">
                            <Interruptor
                              etiqueta={`${p.etiqueta}: ${f.nombre}`}
                              activo={esAdmin || Boolean(f[p.columna])}
                              deshabilitado={esAdmin || !f.activo || ocupado === f.id}
                              onCambiar={(v) => void cambiarPermiso(f, p.columna, v)}
                            />
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        {f.id === yo?.id ? (
                          <span className="text-xs text-zinc-400">Activa</span>
                        ) : (
                          <Boton
                            variante={f.activo ? 'peligro' : 'secundario'}
                            disabled={ocupado === f.id}
                            onClick={() => void cambiarEstado(f)}
                          >
                            {f.activo ? 'Desactivar' : 'Reactivar'}
                          </Boton>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      <p className="text-xs text-zinc-500">Los administradores tienen siempre todos los permisos.</p>

      <NuevaCuenta
        alCrear={(texto) => {
          setMensaje({ tipo: 'exito', texto })
          void cargar()
        }}
      />
    </div>
  )
}
