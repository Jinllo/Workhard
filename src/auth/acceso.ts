import type { Personal } from '../lib/tipos'

export type EstadoAcceso = 'cargando' | 'sin_sesion' | 'sin_ficha' | 'desactivado' | 'ok'

/**
 * Decide qué ve el usuario (HU-2):
 * - sin sesión → pantalla de inicio de sesión (criterio 2)
 * - cuenta desactivada → aviso y cierre de sesión (criterio 3)
 * - cuenta de Auth sin ficha de personal → sin acceso
 */
export function decidirAcceso(params: {
  cargando: boolean
  conSesion: boolean
  personal: Personal | null
}): EstadoAcceso {
  if (params.cargando) return 'cargando'
  if (!params.conSesion) return 'sin_sesion'
  if (!params.personal) return 'sin_ficha'
  if (!params.personal.activo) return 'desactivado'
  return 'ok'
}

/** Traduce los errores de Supabase Auth al iniciar sesión. */
export function mensajeErrorLogin(error: { message?: string; code?: string } | null): string {
  const texto = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase()
  if (texto.includes('banned')) return 'Tu cuenta está desactivada. Habla con el administrador.'
  if (texto.includes('invalid') && texto.includes('credential')) return 'Correo o contraseña incorrectos.'
  if (texto.includes('email') && texto.includes('confirm')) return 'La cuenta aún no está confirmada.'
  if (texto.includes('rate') || texto.includes('too many')) return 'Demasiados intentos. Espera un momento y vuelve a intentar.'
  if (texto.includes('fetch') || texto.includes('network')) return 'Sin conexión con el servidor. Revisa tu internet.'
  return 'No se pudo iniciar sesión. Intenta de nuevo.'
}
