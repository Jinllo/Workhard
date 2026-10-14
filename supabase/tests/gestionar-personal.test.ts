import { describe, expect, it } from 'vitest'
import { PERMISOS_INSTRUCTOR, validarSolicitud } from '../functions/gestionar-personal/logica'

const BASE = { accion: 'crear', email: ' Ana@Ejemplo.cl ', password: 'segura123', nombre: ' Ana Ficticia ', rol: 'instructor' }

describe('gestionar-personal · validarSolicitud', () => {
  it('acepta una cuenta de instructor y normaliza los datos', () => {
    const r = validarSolicitud(BASE)
    expect(r).toEqual({
      ok: true,
      solicitud: { ...BASE, email: 'ana@ejemplo.cl', nombre: 'Ana Ficticia', permisos: PERMISOS_INSTRUCTOR },
    })
  })

  it('respeta los permisos indicados para un instructor', () => {
    const r = validarSolicitud({ ...BASE, permisos: { asignar_planes: false } })
    expect(r.ok && r.solicitud.accion === 'crear' && r.solicitud.permisos.asignar_planes).toBe(false)
  })

  it('un admin siempre recibe todos los permisos', () => {
    const r = validarSolicitud({ ...BASE, rol: 'admin', permisos: { asignar_planes: false } })
    expect(r.ok && r.solicitud.accion === 'crear' && Object.values(r.solicitud.permisos).every(Boolean)).toBe(true)
  })

  it.each([
    [{ ...BASE, nombre: '  ' }, /nombre/],
    [{ ...BASE, email: 'sin-arroba' }, /correo/],
    [{ ...BASE, password: 'corta' }, /8 caracteres/],
    [{ ...BASE, rol: 'superusuario' }, /rol/],
    [{ accion: 'borrar_todo' }, /desconocida/],
    [null, /inválida/],
  ])('rechaza solicitudes inválidas (%#)', (body, mensaje) => {
    const r = validarSolicitud(body)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(mensaje)
  })

  it('valida el cambio de estado', () => {
    const id = 'aa000000-0000-4000-8000-000000000002'
    expect(validarSolicitud({ accion: 'cambiar_estado', id, activo: false })).toEqual({
      ok: true,
      solicitud: { accion: 'cambiar_estado', id, activo: false },
    })
    expect(validarSolicitud({ accion: 'cambiar_estado', id: 'x', activo: false }).ok).toBe(false)
    expect(validarSolicitud({ accion: 'cambiar_estado', id, activo: 'no' }).ok).toBe(false)
  })
})
