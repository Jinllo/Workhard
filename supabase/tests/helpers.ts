// Utilidades compartidas por las pruebas de base de datos (PGlite).
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(import.meta.dirname, '..')

export const MIGRACIONES = readdirSync(join(DIR, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(DIR, 'migrations', f), 'utf8'))

export const SEED = readFileSync(join(DIR, 'seed.sql'), 'utf8')

// Lo mínimo de Supabase que usan las migraciones.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Igual que Supabase: los roles de la API reciben privilegios por defecto
  -- y el RLS es lo que realmente restringe.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`

export async function crearBase(opciones: { seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const sql of MIGRACIONES) await db.exec(sql)
  if (opciones.seed) await db.exec(SEED)
  return db
}

export async function num(db: PGlite, sql: string): Promise<number> {
  const r = await db.query<{ n: number }>(sql)
  return Number(r.rows[0].n)
}

/** Ejecuta fn como un usuario de la API: anon (uid null) o authenticated con ese uid. */
export async function como<T>(db: PGlite, uid: string | null, fn: () => Promise<T>): Promise<T> {
  const rol = uid ? 'authenticated' : 'anon'
  await db.exec(`set role ${rol}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
