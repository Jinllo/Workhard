-- =====================================================================
-- HU-3 · Permisos ajustables por usuario, validados en la base (RNF-03)
--
-- Los permisos se leen de public.personal en CADA consulta, así que un
-- cambio del administrador aplica en la siguiente acción del instructor
-- sin cerrar sesión ni reinstalar nada (criterio 3).
--
-- Reglas generales:
-- * anon (sin sesión) no ve nada: todas las políticas son "to authenticated".
-- * Un usuario sin fila en personal, o con activo = false, no ve nada.
-- * Los administradores tienen todos los permisos.
-- * Las reglas finas de inscripción y asistencia se cierran con funciones
--   RPC en el Sprint 2; estas políticas son la base mínima.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Permisos de quien hace la consulta. security definer evita que las
-- políticas de personal se evalúen a sí mismas (recursión).
create function private.es_personal_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.personal p where p.id = auth.uid() and p.activo
  );
$$;

create function private.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.personal p where p.id = auth.uid() and p.activo and p.rol = 'admin'
  );
$$;

-- permiso: 'crear_alumnos' | 'asignar_planes' | 'extender' | 'editar_grilla'
create function private.tiene_permiso(permiso text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.personal p
    where p.id = auth.uid()
      and p.activo
      and (
        p.rol = 'admin'
        or case permiso
             when 'crear_alumnos'  then p.puede_crear_alumnos
             when 'asignar_planes' then p.puede_asignar_planes
             when 'extender'       then p.puede_extender
             when 'editar_grilla'  then p.puede_editar_grilla
             else false
           end
      )
  );
$$;

revoke all on function private.es_personal_activo(), private.es_admin(), private.tiene_permiso(text) from public;
grant execute on function private.es_personal_activo(), private.es_admin(), private.tiene_permiso(text) to authenticated;

-- ---------------------------------------------------------------------
-- personal: todo el personal activo ve a sus colegas (nombres de
-- instructores en la agenda). Cada uno ve siempre su propia ficha, para
-- que la app pueda avisar «tu cuenta está desactivada». Solo un admin
-- edita. Altas y bajas de cuentas pasan por la Edge Function
-- gestionar-personal.
-- ---------------------------------------------------------------------
alter table public.personal add column email text;
comment on column public.personal.email is 'Correo de acceso (copia de auth.users para mostrarlo en la app).';

create policy personal_select on public.personal
  for select to authenticated using (id = auth.uid() or private.es_personal_activo());
create policy personal_update on public.personal
  for update to authenticated using (private.es_admin()) with check (private.es_admin());

-- Nunca puede quedar el sistema sin administradores activos.
create function private.proteger_ultimo_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.rol = 'admin' and old.activo
     and (tg_op = 'DELETE' or new.rol <> 'admin' or not new.activo)
     and not exists (
       select 1 from public.personal p
       where p.id <> old.id and p.rol = 'admin' and p.activo
     )
  then
    raise exception 'Debe quedar al menos un administrador activo.'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger personal_ultimo_admin
  before update or delete on public.personal
  for each row execute function private.proteger_ultimo_admin();

-- ---------------------------------------------------------------------
-- alumno
-- ---------------------------------------------------------------------
create policy alumno_select on public.alumno
  for select to authenticated using (private.es_personal_activo());
create policy alumno_insert on public.alumno
  for insert to authenticated with check (private.tiene_permiso('crear_alumnos'));
create policy alumno_update on public.alumno
  for update to authenticated
  using (private.tiene_permiso('crear_alumnos')) with check (private.tiene_permiso('crear_alumnos'));
create policy alumno_delete on public.alumno
  for delete to authenticated using (private.es_admin());

-- ---------------------------------------------------------------------
-- tipo_plan (catálogo): lo mantiene el admin.
-- ---------------------------------------------------------------------
create policy tipo_plan_select on public.tipo_plan
  for select to authenticated using (private.es_personal_activo());
create policy tipo_plan_admin on public.tipo_plan
  for all to authenticated using (private.es_admin()) with check (private.es_admin());

-- ---------------------------------------------------------------------
-- plan_alumno
-- La extensión se moverá a una RPC en HU-11 para que "extender" no
-- permita editar otras columnas.
-- ---------------------------------------------------------------------
create policy plan_alumno_select on public.plan_alumno
  for select to authenticated using (private.es_personal_activo());
create policy plan_alumno_insert on public.plan_alumno
  for insert to authenticated with check (private.tiene_permiso('asignar_planes'));
create policy plan_alumno_update on public.plan_alumno
  for update to authenticated
  using (private.tiene_permiso('asignar_planes') or private.tiene_permiso('extender'))
  with check (private.tiene_permiso('asignar_planes') or private.tiene_permiso('extender'));
create policy plan_alumno_delete on public.plan_alumno
  for delete to authenticated using (private.es_admin());

-- ---------------------------------------------------------------------
-- plantilla_bloque (grilla semanal)
-- ---------------------------------------------------------------------
create policy plantilla_select on public.plantilla_bloque
  for select to authenticated using (private.es_personal_activo());
create policy plantilla_write on public.plantilla_bloque
  for all to authenticated
  using (private.tiene_permiso('editar_grilla')) with check (private.tiene_permiso('editar_grilla'));

-- ---------------------------------------------------------------------
-- clase y reserva: todo el personal activo agenda e inscribe (D2).
-- ---------------------------------------------------------------------
create policy clase_select on public.clase
  for select to authenticated using (private.es_personal_activo());
create policy clase_insert on public.clase
  for insert to authenticated with check (private.es_personal_activo());
create policy clase_update on public.clase
  for update to authenticated using (private.es_personal_activo()) with check (private.es_personal_activo());
create policy clase_delete on public.clase
  for delete to authenticated using (private.es_admin());

create policy reserva_select on public.reserva
  for select to authenticated using (private.es_personal_activo());
create policy reserva_insert on public.reserva
  for insert to authenticated with check (private.es_personal_activo());
create policy reserva_update on public.reserva
  for update to authenticated using (private.es_personal_activo()) with check (private.es_personal_activo());
create policy reserva_delete on public.reserva
  for delete to authenticated using (private.es_admin());

-- ---------------------------------------------------------------------
-- auditoria: solo lectura para administradores (HU-25).
-- ---------------------------------------------------------------------
create policy auditoria_select on public.auditoria
  for select to authenticated using (private.es_admin());
