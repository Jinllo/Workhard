import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EnvError, parseSupabaseEnv, type SupabaseEnv } from './env'

export type SupabaseSetup =
  | { ok: true; env: SupabaseEnv; client: SupabaseClient }
  | { ok: false; error: string }

function setup(): SupabaseSetup {
  try {
    const env = parseSupabaseEnv(import.meta.env)
    const client = createClient(env.url, env.publishableKey)
    return { ok: true, env, client }
  } catch (e) {
    const message = e instanceof EnvError ? e.message : 'No se pudo inicializar Supabase.'
    return { ok: false, error: message }
  }
}

export const supabaseSetup = setup()

/** Verifica que el proyecto de Supabase responde con la clave pública configurada. */
export async function checkSupabase(env: SupabaseEnv): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.publishableKey },
    })
    if (res.ok) return { ok: true, detail: 'Supabase responde correctamente.' }
    return { ok: false, detail: `Supabase respondió con estado ${res.status}.` }
  } catch {
    return { ok: false, detail: 'No hubo respuesta de Supabase (red o URL incorrecta).' }
  }
}
