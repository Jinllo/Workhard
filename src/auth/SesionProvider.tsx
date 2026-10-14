import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Personal } from '../lib/tipos'
import { decidirAcceso, mensajeErrorLogin } from './acceso'
import { SesionContext, type Sesion } from './sesion'

const COLUMNAS =
  'id, nombre, email, rol, puede_crear_alumnos, puede_asignar_planes, puede_extender, puede_editar_grilla, activo'

export function SesionProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sesionLista, setSesionLista] = useState(false)
  const [personal, setPersonal] = useState<Personal | null>(null)
  const [fichaDe, setFichaDe] = useState<string | null>(null) // uid cuya ficha ya se cargó

  useEffect(() => {
    client.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSesionLista(true)
    })
    // No llamar a Supabase dentro de este callback (puede bloquearse): solo guardar la sesión.
    const { data } = client.auth.onAuthStateChange((_evento, nueva) => {
      setSession(nueva)
      setSesionLista(true)
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  const uid = session?.user.id ?? null

  const [version, setVersion] = useState(0)

  // Lee la ficha propia cada vez que cambia el usuario o se pide recargar.
  useEffect(() => {
    if (!uid) return
    let vigente = true
    client
      .from('personal')
      .select(COLUMNAS)
      .eq('id', uid)
      .maybeSingle<Personal>()
      .then(({ data }) => {
        if (!vigente) return
        setPersonal(data ?? null)
        setFichaDe(uid)
      })
    return () => {
      vigente = false
    }
  }, [client, uid, version])

  const cargarFicha = useCallback(async () => setVersion((v) => v + 1), [])

  // La ficha solo vale si corresponde al usuario de la sesión actual.
  const fichaVigente = uid !== null && fichaDe === uid ? personal : null

  const valor = useMemo<Sesion>(() => {
    const cargando = !sesionLista || (uid !== null && fichaDe !== uid)
    return {
      estado: decidirAcceso({ cargando, conSesion: uid !== null, personal: fichaVigente }),
      personal: fichaVigente,
      email: session?.user.email ?? null,
      iniciarSesion: async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        return error ? mensajeErrorLogin(error) : null
      },
      cerrarSesion: async () => {
        await client.auth.signOut()
      },
      recargar: cargarFicha,
    }
  }, [client, session, sesionLista, uid, fichaDe, fichaVigente, cargarFicha])

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}
