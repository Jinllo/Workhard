-- =====================================================================
-- HU-4 · Auditoría automática de cambios (RF-19, RNF-04)
--
-- Cada INSERT, UPDATE o DELETE en las tablas de negocio deja una fila
-- con tabla, acción, usuario (auth.uid()), fecha y valores antes/después.
-- La auditoría solo la escribe el trigger: nadie puede insertar, editar
-- ni borrar filas vía API (criterio 2).
-- =====================================================================

create table public.auditoria (
  id           bigint generated always as identity primary key,
  tabla        text not null,
  registro_id  uuid not null,
  accion       text not null check (accion in ('insert', 'update', 'delete')),
  usuario_id   uuid,            -- null = proceso del sistema (migración o seed)
  antes        jsonb,
  despues      jsonb,
  fecha        timestamptz not null default now()
);
comment on table public.auditoria is 'Historial inmutable de cambios. Solo la escribe public.auditar().';
create index auditoria_registro_idx on public.auditoria (tabla, registro_id, fecha desc);
create index auditoria_usuario_idx on public.auditoria (usuario_id, fecha desc);

alter table public.auditoria enable row level security;

-- Defensa en profundidad: aunque luego se agregue una política por error,
-- los roles de la API no tienen privilegios de escritura sobre la tabla.
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;

-- security definer: corre con los privilegios del dueño (postgres) para
-- poder escribir en auditoria aunque el usuario no tenga permiso.
create function public.auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accion text := lower(tg_op);
  v_antes  jsonb;
  v_despues jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_antes := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_despues := to_jsonb(new);
  end if;

  -- Un UPDATE que no cambia nada no deja rastro.
  if tg_op = 'UPDATE' and v_antes = v_despues then
    return new;
  end if;

  insert into public.auditoria (tabla, registro_id, accion, usuario_id, antes, despues)
  values (
    tg_table_name,
    coalesce((v_despues ->> 'id')::uuid, (v_antes ->> 'id')::uuid),
    v_accion,
    auth.uid(),
    v_antes,
    v_despues
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function public.auditar() from public, anon, authenticated;

create trigger auditar_personal         after insert or update or delete on public.personal         for each row execute function public.auditar();
create trigger auditar_alumno           after insert or update or delete on public.alumno           for each row execute function public.auditar();
create trigger auditar_tipo_plan        after insert or update or delete on public.tipo_plan        for each row execute function public.auditar();
create trigger auditar_plan_alumno      after insert or update or delete on public.plan_alumno      for each row execute function public.auditar();
create trigger auditar_plantilla_bloque after insert or update or delete on public.plantilla_bloque for each row execute function public.auditar();
create trigger auditar_clase            after insert or update or delete on public.clase            for each row execute function public.auditar();
create trigger auditar_reserva          after insert or update or delete on public.reserva          for each row execute function public.auditar();
