import { describe, expect, it } from 'vitest'
import type { Personal } from '../lib/tipos'
import { tienePermiso } from '../lib/tipos'
import { decidirAcceso, mensajeErrorLogin } from './acceso'

const INSTRUCTOR: Personal = {
  id: 'x',
  nombre: 'Instructor Ficticio',
  email: 'i@ejemplo.cl',
  rol: 'instructor',
  puede_crear_alumnos: true,
  puede_asignar_planes: false,
  puede_extender: true,
  puede_editar_grilla: false,
  activo: true,
}

describe('decidirAcceso (HU-2)', () => {
  it('sin sesión manda al inicio de sesión (criterio 2)', () => {
    expect(decidirAcceso({ cargando: false, conSesion: false, personal: null })).toBe('sin_sesion')
  })
  it('espera mientras carga', () => {
    expect(decidirAcceso({ cargando: true, conSesion: false, personal: null })).toBe('cargando')
  })
  it('una cuenta desactivada no entra (criterio 3)', () => {
    expect(decidirAcceso({ cargando: false, conSesion: true, personal: { ...INSTRUCTOR, activo: false } })).toBe(
      'desactivado',
    )
  })
  it('una cuenta sin ficha de personal no entra', () => {
    expect(decidirAcceso({ cargando: false, conSesion: true, personal: null })).toBe('sin_ficha')
  })
  it('personal activo entra', () => {
    expect(decidirAcceso({ cargando: false, conSesion: true, personal: INSTRUCTOR })).toBe('ok')
  })
})

describe('mensajeErrorLogin', () => {
  it('explica una cuenta bloqueada', () => {
    expect(mensajeErrorLogin({ code: 'user_banned', message: 'User is banned' })).toMatch(/desactivada/)
  })
  it('explica credenciales incorrectas', () => {
    expect(mensajeErrorLogin({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toMatch(/incorrectos/)
  })
  it('tiene un mensaje genérico', () => {
    expect(mensajeErrorLogin(null)).toMatch(/No se pudo/)
  })
})

describe('tienePermiso (HU-3, solo para mostrar u ocultar acciones)', () => {
  it('usa los permisos de la ficha', () => {
    expect(tienePermiso(INSTRUCTOR, 'crear_alumnos')).toBe(true)
    expect(tienePermiso(INSTRUCTOR, 'asignar_planes')).toBe(false)
  })
  it('el admin tiene todos', () => {
    expect(tienePermiso({ ...INSTRUCTOR, rol: 'admin' }, 'asignar_planes')).toBe(true)
  })
  it('una cuenta inactiva no tiene ninguno', () => {
    expect(tienePermiso({ ...INSTRUCTOR, activo: false }, 'crear_alumnos')).toBe(false)
  })
})
