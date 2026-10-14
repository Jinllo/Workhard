export type Rol = 'admin' | 'instructor'

export type Personal = {
  id: string
  nombre: string
  email: string | null
  rol: Rol
  puede_crear_alumnos: boolean
  puede_asignar_planes: boolean
  puede_extender: boolean
  puede_editar_grilla: boolean
  activo: boolean
}

export type Permiso = 'crear_alumnos' | 'asignar_planes' | 'extender' | 'editar_grilla'

export const PERMISOS: { clave: Permiso; columna: keyof Personal; etiqueta: string }[] = [
  { clave: 'crear_alumnos', columna: 'puede_crear_alumnos', etiqueta: 'Crear alumnos' },
  { clave: 'asignar_planes', columna: 'puede_asignar_planes', etiqueta: 'Asignar planes' },
  { clave: 'extender', columna: 'puede_extender', etiqueta: 'Extender planes' },
  { clave: 'editar_grilla', columna: 'puede_editar_grilla', etiqueta: 'Editar grilla' },
]

/** Igual que private.tiene_permiso() en la base: el admin tiene todo. La base es la que manda (RLS). */
export function tienePermiso(p: Personal | null, permiso: Permiso): boolean {
  if (!p || !p.activo) return false
  if (p.rol === 'admin') return true
  const def = PERMISOS.find((x) => x.clave === permiso)
  return def ? Boolean(p[def.columna]) : false
}
