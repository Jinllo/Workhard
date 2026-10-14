import { createContext, useContext } from 'react'
import type { Personal } from '../lib/tipos'
import type { EstadoAcceso } from './acceso'

export type Sesion = {
  estado: EstadoAcceso
  personal: Personal | null
  email: string | null
  /** Devuelve un mensaje de error o null si inició sesión. */
  iniciarSesion: (email: string, password: string) => Promise<string | null>
  cerrarSesion: () => Promise<void>
  /** Vuelve a leer la ficha propia (por ejemplo, tras cambiar permisos). */
  recargar: () => Promise<void>
}

export const SesionContext = createContext<Sesion | null>(null)

export function useSesion(): Sesion {
  const s = useContext(SesionContext)
  if (!s) throw new Error('useSesion debe usarse dentro de <SesionProvider>')
  return s
}
