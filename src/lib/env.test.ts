import { describe, expect, it } from 'vitest'
import { EnvError, isSecretKey, parseSupabaseEnv } from './env'

const URL_OK = 'https://abcdefghijkl.supabase.co'

function fakeJwt(role: string): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role })}.firma`
}

describe('isSecretKey', () => {
  it('detecta la secret key nueva', () => {
    expect(isSecretKey('sb_secret_123')).toBe(true)
  })
  it('detecta la service_role heredada', () => {
    expect(isSecretKey(fakeJwt('service_role'))).toBe(true)
  })
  it('acepta la publishable key y la anon heredada', () => {
    expect(isSecretKey('sb_publishable_123')).toBe(false)
    expect(isSecretKey(fakeJwt('anon'))).toBe(false)
  })
})

describe('parseSupabaseEnv', () => {
  it('devuelve la configuración válida', () => {
    const env = parseSupabaseEnv({
      VITE_SUPABASE_URL: `${URL_OK}/`,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_123',
    })
    expect(env).toEqual({ url: URL_OK, publishableKey: 'sb_publishable_123' })
  })
  it('falla si faltan variables', () => {
    expect(() => parseSupabaseEnv({})).toThrow(EnvError)
  })
  it('falla con una URL que no es de Supabase', () => {
    expect(() =>
      parseSupabaseEnv({ VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1' }),
    ).toThrow(EnvError)
  })
  it('se niega a usar una clave privada en el frontend', () => {
    expect(() =>
      parseSupabaseEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' }),
    ).toThrow(/privada/)
    expect(() =>
      parseSupabaseEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: fakeJwt('service_role') }),
    ).toThrow(/privada/)
  })
})
