// Validación de las solicitudes a gestionar-personal.
// Sin dependencias, para probarla con Vitest y usarla desde Deno.

export type Permisos = {
  crear_alumnos: boolean
  asignar_planes: boolean
  extender: boolean
  editar_grilla: boolean
}

export type SolicitudCrear = {
  accion: 'crear'
  email: string
  password: string
  nombre: string
  rol: 'admin' | 'instructor'
  permisos: Permisos
}

export type SolicitudCambiarEstado = {
  accion: 'cambiar_estado'
  id: string
  activo: boolean
}

export type Solicitud = SolicitudCrear | SolicitudCambiarEstado

export type Resultado = { ok: true; solicitud: Solicitud } | { ok: false; error: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Permisos por defecto de un instructor nuevo (los ajusta luego el admin). */
export const PERMISOS_INSTRUCTOR: Permisos = {
  crear_alumnos: true,
  asignar_planes: true,
  extender: true,
  editar_grilla: false,
}

const TODOS: Permisos = { crear_alumnos: true, asignar_planes: true, extender: true, editar_grilla: true }

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function leerPermisos(v: unknown, rol: 'admin' | 'instructor'): Permisos {
  if (rol === 'admin') return TODOS
  const p = esObjeto(v) ? v : {}
  const leer = (k: keyof Permisos) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : PERMISOS_INSTRUCTOR[k])
  return {
    crear_alumnos: leer('crear_alumnos'),
    asignar_planes: leer('asignar_planes'),
    extender: leer('extender'),
    editar_grilla: leer('editar_grilla'),
  }
}

export function validarSolicitud(body: unknown): Resultado {
  if (!esObjeto(body)) return { ok: false, error: 'Solicitud inválida.' }

  if (body.accion === 'crear') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    const rol = body.rol

    if (!nombre) return { ok: false, error: 'El nombre es obligatorio.' }
    if (!EMAIL.test(email)) return { ok: false, error: 'El correo no es válido.' }
    if (password.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
    if (rol !== 'admin' && rol !== 'instructor') return { ok: false, error: 'El rol debe ser admin o instructor.' }

    return {
      ok: true,
      solicitud: { accion: 'crear', email, password, nombre, rol, permisos: leerPermisos(body.permisos, rol) },
    }
  }

  if (body.accion === 'cambiar_estado') {
    if (typeof body.id !== 'string' || !UUID.test(body.id)) return { ok: false, error: 'Identificador inválido.' }
    if (typeof body.activo !== 'boolean') return { ok: false, error: 'Falta indicar si la cuenta queda activa.' }
    return { ok: true, solicitud: { accion: 'cambiar_estado', id: body.id, activo: body.activo } }
  }

  return { ok: false, error: 'Acción desconocida.' }
}
