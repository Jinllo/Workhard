// HU-2 / HU-3 · Acceso y permisos validados en la base de datos (RLS).
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { como, crearBase, num } from './helpers'

const ADMIN = 'aa000000-0000-4000-8000-000000000001'
const INSTRUCTOR = 'aa000000-0000-4000-8000-000000000002' // sin permiso para asignar planes
const COMPLETO = 'aa000000-0000-4000-8000-000000000003' // instructor con todos los permisos
const INACTIVO = 'aa000000-0000-4000-8000-000000000004'
const SIN_FICHA = 'aa000000-0000-4000-8000-000000000005' // cuenta de Auth sin fila en personal

const ALUMNO = 'a1000000-0000-4000-8000-000000000006'
const PLAN_8 = '7a000000-0000-4000-8000-000000000008'
const insertarPlan = (id: string) => `
  insert into public.plan_alumno (id, alumno_id, tipo_plan_id, modalidad, fecha_inicio, fecha_fin, sesiones_totales)
  values ('${id}', '${ALUMNO}', '${PLAN_8}', 'general', current_date, current_date + 30, 8)`

let db: PGlite

beforeAll(async () => {
  db = await crearBase({ seed: true })
  await db.exec(`
    insert into auth.users (id) values ('${ADMIN}'), ('${INSTRUCTOR}'), ('${COMPLETO}'), ('${INACTIVO}'), ('${SIN_FICHA}');
    insert into public.personal (id, nombre, rol, puede_asignar_planes, activo) values
      ('${ADMIN}',      'Admin Ficticio',       'admin',      true,  true),
      ('${INSTRUCTOR}', 'Instructor Ficticio',  'instructor', false, true),
      ('${COMPLETO}',   'Instructora Ficticia', 'instructor', true,  true),
      ('${INACTIVO}',   'Inactivo Ficticio',    'instructor', true,  false);
  `)
})

describe('HU-2 · acceso según la cuenta', () => {
  it('sin sesión (anon) no se ve ningún dato', async () => {
    expect(await como(db, null, () => num(db, 'select count(*)::int as n from public.alumno'))).toBe(0)
    expect(await como(db, null, () => num(db, 'select count(*)::int as n from public.personal'))).toBe(0)
  })

  it('el personal activo ve los alumnos', async () => {
    expect(await como(db, INSTRUCTOR, () => num(db, 'select count(*)::int as n from public.alumno'))).toBe(10)
  })

  it('una cuenta desactivada no ve nada aunque tenga sesión (solo su propia ficha)', async () => {
    expect(await como(db, INACTIVO, () => num(db, 'select count(*)::int as n from public.alumno'))).toBe(0)
    const fichas = await como(db, INACTIVO, () =>
      db.query<{ id: string; activo: boolean }>('select id, activo from public.personal'),
    )
    expect(fichas.rows).toEqual([{ id: INACTIVO, activo: false }])
    await expect(como(db, INACTIVO, () => db.exec(insertarPlan('e0000000-0000-4000-8000-000000000001')))).rejects.toThrow(
      /row-level security/,
    )
  })

  it('una cuenta de Auth sin ficha de personal no ve nada', async () => {
    expect(await como(db, SIN_FICHA, () => num(db, 'select count(*)::int as n from public.alumno'))).toBe(0)
  })
})

describe('HU-3 · permisos ajustables', () => {
  it('criterio 2: sin permiso, asignar un plan directo por la API es rechazado', async () => {
    await expect(como(db, INSTRUCTOR, () => db.exec(insertarPlan('e0000000-0000-4000-8000-000000000002')))).rejects.toThrow(
      /row-level security/,
    )
  })

  it('con permiso, el mismo insert funciona', async () => {
    await como(db, COMPLETO, () => db.exec(insertarPlan('e0000000-0000-4000-8000-000000000003')))
    expect(await num(db, `select count(*)::int as n from public.plan_alumno where id = 'e0000000-0000-4000-8000-000000000003'`)).toBe(1)
  })

  it('criterio 3: el admin activa el permiso y aplica en la siguiente acción', async () => {
    await como(db, ADMIN, () =>
      db.exec(`update public.personal set puede_asignar_planes = true where id = '${INSTRUCTOR}'`),
    )
    await como(db, INSTRUCTOR, () => db.exec(insertarPlan('e0000000-0000-4000-8000-000000000004')))
    expect(await num(db, `select count(*)::int as n from public.plan_alumno where id = 'e0000000-0000-4000-8000-000000000004'`)).toBe(1)
    // y al quitarlo vuelve a quedar bloqueado
    await como(db, ADMIN, () =>
      db.exec(`update public.personal set puede_asignar_planes = false where id = '${INSTRUCTOR}'`),
    )
    await expect(como(db, INSTRUCTOR, () => db.exec(insertarPlan('e0000000-0000-4000-8000-000000000005')))).rejects.toThrow(
      /row-level security/,
    )
  })

  it('un instructor no puede darse permisos a sí mismo', async () => {
    await como(db, INSTRUCTOR, () =>
      db.exec(`update public.personal set puede_asignar_planes = true, rol = 'admin' where id = '${INSTRUCTOR}'`),
    )
    const r = await db.query<{ rol: string; puede_asignar_planes: boolean }>(
      `select rol, puede_asignar_planes from public.personal where id = '${INSTRUCTOR}'`,
    )
    expect(r.rows[0]).toEqual({ rol: 'instructor', puede_asignar_planes: false })
  })

  it('solo el admin mantiene el catálogo de planes', async () => {
    await expect(
      como(db, COMPLETO, () =>
        db.exec(`insert into public.tipo_plan (nombre, modalidad, sesiones) values ('Plan 30', 'general', 30)`),
      ),
    ).rejects.toThrow(/row-level security/)
    await como(db, ADMIN, () =>
      db.exec(`insert into public.tipo_plan (nombre, modalidad, sesiones) values ('Plan 30', 'general', 30)`),
    )
    expect(await num(db, `select count(*)::int as n from public.tipo_plan where nombre = 'Plan 30'`)).toBe(1)
  })

  it('solo el admin ve la auditoría', async () => {
    expect(await como(db, COMPLETO, () => num(db, 'select count(*)::int as n from public.auditoria'))).toBe(0)
    expect(await como(db, ADMIN, () => num(db, 'select count(*)::int as n from public.auditoria'))).toBeGreaterThan(0)
  })

  it('la auditoría registra qué usuario hizo cada cambio', async () => {
    const r = await db.query<{ usuario_id: string }>(
      `select usuario_id from public.auditoria
       where tabla = 'plan_alumno' and registro_id = 'e0000000-0000-4000-8000-000000000004'`,
    )
    expect(r.rows[0].usuario_id).toBe(INSTRUCTOR)
  })

  it('nunca queda el sistema sin un administrador activo', async () => {
    await expect(
      como(db, ADMIN, () => db.exec(`update public.personal set activo = false where id = '${ADMIN}'`)),
    ).rejects.toThrow(/al menos un administrador/)
  })
})
