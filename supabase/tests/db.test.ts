// Pruebas de la base de datos con PGlite (Postgres real compilado a WASM).
// Aplican las migraciones y el seed sobre una base vacía que imita lo mínimo
// de Supabase (esquema auth, auth.uid() y roles anon/authenticated).
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const DIR = join(import.meta.dirname, '..')
const MIGRACIONES = readdirSync(join(DIR, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(DIR, 'migrations', f), 'utf8'))
const SEED = readFileSync(join(DIR, 'seed.sql'), 'utf8')

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Igual que Supabase: los roles de la API reciben privilegios por defecto
  -- y el RLS es lo que realmente restringe.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`

const TABLAS = ['personal', 'alumno', 'tipo_plan', 'plan_alumno', 'plantilla_bloque', 'clase', 'reserva', 'auditoria']
const USUARIO = '11111111-1111-4111-8111-111111111111'

let db: PGlite

async function num(sql: string): Promise<number> {
  const r = await db.query<{ n: number }>(sql)
  return Number(r.rows[0].n)
}

async function comoUsuarioApi<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${USUARIO}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const sql of MIGRACIONES) await db.exec(sql)
})

describe('modelo inicial', () => {
  it('crea las 8 tablas del modelo con RLS activado (RNF-03)', async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
    )
    expect(r.rows.map((x) => x.relname).sort()).toEqual([...TABLAS].sort())
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true)
  })

  it('sin políticas, un usuario de la API no ve ni escribe alumnos', async () => {
    await db.exec(`insert into public.alumno (nombre) values ('Visible solo para postgres')`)
    const visibles = await comoUsuarioApi(() => num('select count(*)::int as n from public.alumno'))
    expect(visibles).toBe(0)
    await expect(
      comoUsuarioApi(() => db.exec(`insert into public.alumno (nombre) values ('Intruso')`)),
    ).rejects.toThrow(/row-level security/)
    await db.exec(`delete from public.alumno where nombre = 'Visible solo para postgres'`)
  })
})

describe('HU-5 · datos ficticios', () => {
  beforeAll(async () => {
    await db.exec(SEED)
  })

  it('crea el catálogo, 10 alumnos y planes asignados', async () => {
    expect(await num('select count(*)::int as n from public.tipo_plan')).toBe(6)
    expect(await num('select count(*)::int as n from public.alumno')).toBe(10)
    expect(await num('select count(*)::int as n from public.plan_alumno')).toBe(9)
    const generales = await db.query<{ sesiones: number }>(
      `select sesiones from public.tipo_plan where modalidad = 'general' order by sesiones`,
    )
    expect(generales.rows.map((r) => r.sesiones)).toEqual([8, 12, 16, 20])
  })

  it('es idempotente: ejecutarlo dos veces da el mismo resultado', async () => {
    const huella = `select md5(string_agg(t::text, '|' order by t::text)) as h from (
      select id::text from public.alumno union all select id::text from public.plan_alumno
      union all select id::text from public.tipo_plan) t`
    const antes = (await db.query<{ h: string }>(huella)).rows[0].h
    await db.exec(SEED)
    const despues = (await db.query<{ h: string }>(huella)).rows[0].h
    expect(despues).toBe(antes)
    expect(await num('select count(*)::int as n from public.alumno')).toBe(10)
  })

  it('solo contiene datos marcados como ficticios', async () => {
    expect(await num(`select count(*)::int as n from public.alumno where notas not like 'Dato ficticio%'`)).toBe(0)
    expect(await num(`select count(*)::int as n from public.alumno where telefono not like '+56 9 0000 %'`)).toBe(0)
  })

  it('cubre los casos de prueba: vigente, por vencer, extendido, vencido, sin plan, 1-1', async () => {
    const r = await db.query<{ alumno_id: string; en_periodo: boolean; extendido: boolean; modalidad: string }>(
      `select alumno_id, en_periodo, extendido, modalidad from public.plan_saldo`,
    )
    const de = (n: number) => r.rows.filter((x) => x.alumno_id.endsWith(String(n).padStart(2, '0')))
    expect(de(4)[0]).toMatchObject({ extendido: true, en_periodo: true })
    expect(de(5)[0]).toMatchObject({ en_periodo: false })
    expect(de(6)).toHaveLength(0)
    expect(de(3).map((x) => x.modalidad).sort()).toEqual(['general', 'uno_a_uno'])
    expect(de(9)[0]).toMatchObject({ modalidad: 'uno_a_uno', en_periodo: true })
  })
})

describe('reglas del modelo', () => {
  it('la modalidad del plan siempre se copia del catálogo', async () => {
    await db.exec(`
      insert into public.plan_alumno (id, alumno_id, tipo_plan_id, modalidad, fecha_inicio, fecha_fin, sesiones_totales)
      values ('c3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000006',
              '7a000000-0000-4000-8000-000000000104', 'general', current_date, current_date + 30, 4)`)
    const m = await db.query<{ modalidad: string }>(
      `select modalidad from public.plan_alumno where id = 'c3000000-0000-4000-8000-000000000001'`,
    )
    expect(m.rows[0].modalidad).toBe('uno_a_uno')
  })

  it('una clase 1-1 debe tener aforo 1', async () => {
    await expect(
      db.exec(`insert into public.clase (fecha, hora_inicio, hora_fin, tipo, aforo)
               values (current_date, '10:00', '11:00', 'uno_a_uno', 15)`),
    ).rejects.toThrow(/check constraint/)
  })

  it('un alumno no puede inscribirse dos veces en la misma clase', async () => {
    await db.exec(`insert into public.clase (id, fecha, hora_inicio, hora_fin, tipo, aforo)
                   values ('c4000000-0000-4000-8000-000000000001', current_date, '18:00', '19:00', 'general', 15)`)
    const reserva = `insert into public.reserva (clase_id, alumno_id, plan_alumno_id)
      values ('c4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
              'b2000000-0000-4000-8000-000000000001')`
    await db.exec(reserva)
    await expect(db.exec(reserva)).rejects.toThrow(/duplicate key/)
  })

  it('el saldo descuenta reservada, asistió y ausente injustificada (caso HU-22)', async () => {
    // Plan 8 nuevo con 3 asistidas, 1 cancelada, 1 justificada, 1 injustificada y 1 reservada → 5 usadas, 3 disponibles
    await db.exec(`
      insert into public.plan_alumno (id, alumno_id, tipo_plan_id, modalidad, fecha_inicio, fecha_fin, sesiones_totales)
      values ('c5000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000010',
              '7a000000-0000-4000-8000-000000000008', 'general', current_date, current_date + 30, 8);
      insert into public.clase (id, fecha, hora_inicio, hora_fin, tipo, aforo)
      select ('c6000000-0000-4000-8000-00000000000' || g)::uuid, current_date + g, '08:00', '09:00', 'general', 15
      from generate_series(1, 7) g;
      insert into public.reserva (clase_id, alumno_id, plan_alumno_id, estado)
      select ('c6000000-0000-4000-8000-00000000000' || g)::uuid, 'a1000000-0000-4000-8000-000000000010',
             'c5000000-0000-4000-8000-000000000001',
             (array['asistio','asistio','asistio','cancelada','ausente_justificada','ausente_injustificada','reservada'])[g]
      from generate_series(1, 7) g;`)
    const s = await db.query<{ sesiones_usadas: number; sesiones_disponibles: number }>(
      `select sesiones_usadas, sesiones_disponibles from public.plan_saldo
       where plan_alumno_id = 'c5000000-0000-4000-8000-000000000001'`,
    )
    expect(s.rows[0]).toEqual({ sesiones_usadas: 5, sesiones_disponibles: 3 })
  })
})

describe('HU-4 · auditoría automática', () => {
  const ID = 'd7000000-0000-4000-8000-000000000001'
  const auditoria = () =>
    db.query<{ accion: string; usuario_id: string | null; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null }>(
      `select accion, usuario_id, antes, despues from public.auditoria where registro_id = '${ID}' order by id`,
    )

  it('registra alta, edición y baja con usuario, fecha y valores antes/después', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${USUARIO}', false)`)
    await db.exec(`insert into public.alumno (id, nombre) values ('${ID}', 'Auditado Ficticio')`)
    await db.exec(`update public.alumno set telefono = '+56 9 0000 0099' where id = '${ID}'`)
    await db.exec(`update public.alumno set telefono = '+56 9 0000 0099' where id = '${ID}'`) // sin cambios: no audita
    await db.exec(`delete from public.alumno where id = '${ID}'`)
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)

    const r = await auditoria()
    expect(r.rows.map((x) => x.accion)).toEqual(['insert', 'update', 'delete'])
    expect(r.rows.every((x) => x.usuario_id === USUARIO)).toBe(true)
    expect(r.rows[0]).toMatchObject({ antes: null, despues: { nombre: 'Auditado Ficticio' } })
    expect(r.rows[1].antes).toMatchObject({ telefono: null })
    expect(r.rows[1].despues).toMatchObject({ telefono: '+56 9 0000 0099' })
    expect(r.rows[2]).toMatchObject({ despues: null, antes: { nombre: 'Auditado Ficticio' } })
  })

  it('un usuario de la API no puede crear, editar ni borrar la auditoría', async () => {
    for (const sql of [
      `update public.auditoria set accion = 'insert'`,
      `delete from public.auditoria`,
      `insert into public.auditoria (tabla, registro_id, accion) values ('x', '${ID}', 'insert')`,
    ]) {
      await expect(comoUsuarioApi(() => db.exec(sql))).rejects.toThrow(/permission denied/)
    }
    expect(await num(`select count(*)::int as n from public.auditoria where registro_id = '${ID}'`)).toBe(3)
  })

  it('audita las tablas de negocio: alumnos, planes y reservas', async () => {
    const r = await db.query<{ tabla: string }>(`select distinct tabla from public.auditoria order by tabla`)
    expect(r.rows.map((x) => x.tabla)).toEqual(
      expect.arrayContaining(['alumno', 'plan_alumno', 'reserva', 'tipo_plan', 'clase']),
    )
  })
})
