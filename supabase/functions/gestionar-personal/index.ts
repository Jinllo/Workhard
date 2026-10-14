// =====================================================================
// Edge Function: gestionar-personal (HU-2)
//
// Crea cuentas del personal y las activa/desactiva. Corre en Supabase con
// la service key, que NUNCA llega al navegador. Solo la puede usar un
// administrador activo: se verifica el token del usuario en cada llamada.
//
// Acciones (POST, JSON):
//   { accion: 'crear', email, password, nombre, rol, permisos? }
//   { accion: 'cambiar_estado', id, activo }
// Desactivar bloquea el inicio de sesión (ban en Supabase Auth) y, por RLS,
// la cuenta deja de ver datos aunque tenga una sesión abierta.
// =====================================================================
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { validarSolicitud } from './logica.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BLOQUEO_INDEFINIDO = '876000h' // ~100 años

function responder(status: number, cuerpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Clave privada que Supabase inyecta en la función: la service_role heredada
// o, en proyectos con el sistema de claves nuevo, la secret key.
function claveServidor(): string | undefined {
  const heredada = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (heredada) return heredada
  try {
    const nuevas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    return nuevas.default ?? Object.values(nuevas)[0]
  } catch {
    return undefined
  }
}

// La auditoría la escribe un trigger con auth.uid(), que aquí es null porque
// actúa la service key. Se completa con el administrador que hizo el cambio.
async function atribuirAuditoria(sb: SupabaseClient, registroId: string, actor: string) {
  await sb
    .from('auditoria')
    .update({ usuario_id: actor })
    .eq('tabla', 'personal')
    .eq('registro_id', registroId)
    .is('usuario_id', null)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido.' })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = claveServidor()
  if (!url || !serviceKey) return responder(500, { error: 'Función mal configurada.' })

  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1. ¿Quién llama? Debe ser un administrador activo.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return responder(401, { error: 'Falta la sesión.' })
  const { data: auth, error: authError } = await sb.auth.getUser(token)
  if (authError || !auth.user) return responder(401, { error: 'Sesión inválida o expirada.' })
  const actor = auth.user.id

  const { data: yo } = await sb.from('personal').select('rol, activo').eq('id', actor).maybeSingle()
  if (!yo || !yo.activo || yo.rol !== 'admin') {
    return responder(403, { error: 'Solo un administrador puede gestionar cuentas.' })
  }

  // 2. Validar la solicitud.
  const v = validarSolicitud(await req.json().catch(() => null))
  if (!v.ok) return responder(400, { error: v.error })
  const s = v.solicitud

  // 3a. Crear cuenta.
  if (s.accion === 'crear') {
    const { data: creado, error: errorAuth } = await sb.auth.admin.createUser({
      email: s.email,
      password: s.password,
      email_confirm: true, // no se envía correo: la contraseña inicial la entrega el admin
      user_metadata: { nombre: s.nombre },
    })
    if (errorAuth || !creado.user) {
      const yaExiste = /already|registered|exists/i.test(errorAuth?.message ?? '')
      return responder(400, { error: yaExiste ? 'Ya existe una cuenta con ese correo.' : 'No se pudo crear la cuenta.' })
    }

    const { error: errorFicha } = await sb.from('personal').insert({
      id: creado.user.id,
      nombre: s.nombre,
      email: s.email,
      rol: s.rol,
      puede_crear_alumnos: s.permisos.crear_alumnos,
      puede_asignar_planes: s.permisos.asignar_planes,
      puede_extender: s.permisos.extender,
      puede_editar_grilla: s.permisos.editar_grilla,
    })
    if (errorFicha) {
      await sb.auth.admin.deleteUser(creado.user.id) // no dejar cuentas a medias
      return responder(500, { error: 'No se pudo registrar la ficha del personal.' })
    }

    await atribuirAuditoria(sb, creado.user.id, actor)
    return responder(201, { id: creado.user.id })
  }

  // 3b. Activar o desactivar.
  if (s.id === actor && !s.activo) {
    return responder(400, { error: 'No puedes desactivar tu propia cuenta.' })
  }

  const { data: actual } = await sb.from('personal').select('activo').eq('id', s.id).maybeSingle()
  if (!actual) return responder(404, { error: 'La cuenta no existe.' })

  const { error: errorEstado } = await sb.from('personal').update({ activo: s.activo }).eq('id', s.id)
  if (errorEstado) {
    const ultimoAdmin = /administrador activo/i.test(errorEstado.message)
    return responder(400, { error: ultimoAdmin ? 'Debe quedar al menos un administrador activo.' : 'No se pudo cambiar el estado.' })
  }

  const { error: errorBan } = await sb.auth.admin.updateUserById(s.id, {
    ban_duration: s.activo ? 'none' : BLOQUEO_INDEFINIDO,
  })
  if (errorBan) {
    await sb.from('personal').update({ activo: actual.activo }).eq('id', s.id) // revertir
    return responder(500, { error: 'No se pudo actualizar el acceso de la cuenta.' })
  }

  await atribuirAuditoria(sb, s.id, actor)
  return responder(200, { id: s.id, activo: s.activo })
})
