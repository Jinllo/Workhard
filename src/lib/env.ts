// Lectura y validación de las variables de entorno públicas del frontend.
// Todo lo que empieza con VITE_ termina dentro del bundle que descarga el navegador,
// por eso aquí solo puede ir la clave pública (publishable / anon) de Supabase.
// La service key o secret key NUNCA debe llegar al frontend (HU-1, criterio 2).

export type SupabaseEnv = {
  url: string
  publishableKey: string
}

export class EnvError extends Error {}

function decodeJwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(payload)) as { role?: unknown }
    return typeof json.role === 'string' ? json.role : null
  } catch {
    return null
  }
}

/** Indica si una clave es privada (secret key nueva o service_role JWT heredada). */
export function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  return decodeJwtRole(key) === 'service_role'
}

export function parseSupabaseEnv(raw: Record<string, string | undefined>): SupabaseEnv {
  const url = raw.VITE_SUPABASE_URL?.trim()
  const publishableKey = raw.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) {
    throw new EnvError(
      'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Copia .env.example a .env.local y complétalo.',
    )
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
    throw new EnvError('VITE_SUPABASE_URL debe tener la forma https://<proyecto>.supabase.co')
  }
  if (isSecretKey(publishableKey)) {
    throw new EnvError(
      'La clave configurada es privada (secret/service_role). En el frontend solo va la clave pública (publishable o anon).',
    )
  }
  return { url: url.replace(/\/$/, ''), publishableKey }
}
