-- =====================================================================
-- Workhard Concón · Modelo de datos inicial (Sprint 1, sesión 2)
-- Fuente: Notion → Arquitectura, datos e integraciones → 18.4 Modelo ER
--
-- Decisiones de diseño:
-- * Estados como text + CHECK (más fácil de evolucionar que un enum).
-- * El saldo de sesiones NO se guarda: se calcula en la vista plan_saldo
--   a partir de las reservas, así nunca se desincroniza.
-- * RLS activado en TODAS las tablas sin políticas todavía: nadie puede
--   leer ni escribir vía API hasta definir permisos en HU-3 (RNF-03).
-- * Las reglas de negocio (aforo, 2 horas, superposición de planes) se
--   implementan en las funciones RPC de cada historia, con sus pruebas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Personal (instructores y administradores). Uno a uno con auth.users.
-- ---------------------------------------------------------------------
create table public.personal (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nombre                text not null check (length(trim(nombre)) > 0),
  rol                   text not null check (rol in ('admin', 'instructor')),
  puede_crear_alumnos   boolean not null default true,
  puede_asignar_planes  boolean not null default true,
  puede_extender        boolean not null default true,
  puede_editar_grilla   boolean not null default false,
  activo                boolean not null default true,
  creado_en             timestamptz not null default now()
);
comment on table public.personal is 'Cuentas del personal (instructores y administradores) con permisos ajustables (D7).';

-- ---------------------------------------------------------------------
-- Alumnos (sin acceso a la plataforma en el MVP, D1).
-- ---------------------------------------------------------------------
create table public.alumno (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(trim(nombre)) > 0),
  telefono    text,
  email       text,
  fecha_alta  date not null default current_date,
  estado      text not null default 'activo' check (estado in ('activo', 'inactivo')),
  notas       text,
  creado_en   timestamptz not null default now()
);
comment on table public.alumno is 'Alumnos del gimnasio. Teléfono no es único: un duplicado solo se advierte (HU-6).';
create index alumno_telefono_idx on public.alumno (telefono);
create index alumno_nombre_idx on public.alumno (lower(nombre));

-- ---------------------------------------------------------------------
-- Catálogo de planes.
-- ---------------------------------------------------------------------
create table public.tipo_plan (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null unique,
  modalidad       text not null check (modalidad in ('general', 'uno_a_uno')),
  sesiones        integer not null check (sesiones > 0),
  duracion_meses  integer not null default 1 check (duracion_meses > 0),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now()
);
comment on table public.tipo_plan is 'Catálogo: generales de 8, 12, 16, 20 sesiones y planes 1-1 (RN-01, RN-12).';

-- ---------------------------------------------------------------------
-- Plan asignado a un alumno.
-- ---------------------------------------------------------------------
create table public.plan_alumno (
  id                   uuid primary key default gen_random_uuid(),
  alumno_id            uuid not null references public.alumno (id) on delete restrict,
  tipo_plan_id         uuid not null references public.tipo_plan (id) on delete restrict,
  modalidad            text not null check (modalidad in ('general', 'uno_a_uno')),
  fecha_inicio         date not null,
  fecha_fin            date not null,
  sesiones_totales     integer not null check (sesiones_totales > 0),
  extendido            boolean not null default false,
  fecha_fin_extendida  date,
  motivo_extension     text,
  extendido_por        uuid references public.personal (id) on delete set null,
  extendido_en         timestamptz,
  asignado_por         uuid references public.personal (id) on delete set null,
  creado_en            timestamptz not null default now(),
  fecha_fin_efectiva   date generated always as (coalesce(fecha_fin_extendida, fecha_fin)) stored,
  check (fecha_fin >= fecha_inicio),
  check (
    (extendido and fecha_fin_extendida is not null and fecha_fin_extendida > fecha_fin)
    or (not extendido and fecha_fin_extendida is null)
  )
);
comment on table public.plan_alumno is 'Plan contratado. Dura un mes; extensión de 7 días por enfermedad (RN-02, RN-03).';
comment on column public.plan_alumno.modalidad is 'Copia de tipo_plan.modalidad (la fija un trigger) para validar planes por modalidad.';
create index plan_alumno_alumno_idx on public.plan_alumno (alumno_id, fecha_fin_efectiva);

-- La modalidad siempre se copia del tipo de plan, nunca la escribe el cliente.
create function public.plan_alumno_copiar_modalidad()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select tp.modalidad into new.modalidad
  from public.tipo_plan tp
  where tp.id = new.tipo_plan_id;
  return new;
end;
$$;

create trigger plan_alumno_modalidad
  before insert or update of tipo_plan_id on public.plan_alumno
  for each row execute function public.plan_alumno_copiar_modalidad();

-- ---------------------------------------------------------------------
-- Grilla semanal fija (RN-13) e instructor de planta por día (RN-11).
-- ---------------------------------------------------------------------
create table public.plantilla_bloque (
  id             uuid primary key default gen_random_uuid(),
  dia_semana     smallint not null check (dia_semana between 1 and 7), -- ISO: 1 = lunes, 7 = domingo
  hora_inicio    time not null,
  hora_fin       time not null,
  aforo          integer not null default 15 check (aforo > 0),
  instructor_id  uuid references public.personal (id) on delete set null,
  activo         boolean not null default true,
  check (hora_fin > hora_inicio),
  unique (dia_semana, hora_inicio)
);
comment on table public.plantilla_bloque is 'Plantilla semanal de bloques de 1 hora con aforo 15 por defecto (RN-13, RN-14).';

-- ---------------------------------------------------------------------
-- Clases concretas (generadas desde la plantilla o 1-1 puntuales).
-- ---------------------------------------------------------------------
create table public.clase (
  id             uuid primary key default gen_random_uuid(),
  plantilla_id   uuid references public.plantilla_bloque (id) on delete set null,
  fecha          date not null,
  hora_inicio    time not null,
  hora_fin       time not null,
  tipo           text not null check (tipo in ('general', 'uno_a_uno')),
  instructor_id  uuid references public.personal (id) on delete set null,
  aforo          integer not null check (aforo > 0),
  estado         text not null default 'programada' check (estado in ('programada', 'cancelada')),
  creado_en      timestamptz not null default now(),
  check (hora_fin > hora_inicio),
  check (tipo = 'general' or aforo = 1)
);
comment on table public.clase is 'Clase de un día. La 1-1 usa el mismo horario, aforo 1 y no suma al aforo general (RN-12).';
create index clase_fecha_idx on public.clase (fecha, hora_inicio);
-- Una clase general por bloque de plantilla y día (la generación es idempotente, HU-13).
create unique index clase_plantilla_fecha_uq on public.clase (plantilla_id, fecha) where plantilla_id is not null;

-- ---------------------------------------------------------------------
-- Reservas (inscripciones).
-- ---------------------------------------------------------------------
create table public.reserva (
  id              uuid primary key default gen_random_uuid(),
  clase_id        uuid not null references public.clase (id) on delete restrict,
  alumno_id       uuid not null references public.alumno (id) on delete restrict,
  plan_alumno_id  uuid not null references public.plan_alumno (id) on delete restrict,
  estado          text not null default 'reservada' check (
                    estado in ('reservada', 'cancelada', 'asistio', 'ausente_justificada', 'ausente_injustificada')
                  ),
  sobrecupo       boolean not null default false,
  creada_por      uuid references public.personal (id) on delete set null,
  creada_en       timestamptz not null default now(),
  cancelada_en    timestamptz,
  resuelta_por    uuid references public.personal (id) on delete set null,
  motivo          text
);
comment on table public.reserva is 'Inscripción de un alumno en una clase. Descuenta sesión al crearse (RN-05).';
-- Un alumno no puede estar inscrito dos veces en la misma clase (las canceladas no cuentan).
create unique index reserva_clase_alumno_uq on public.reserva (clase_id, alumno_id) where estado <> 'cancelada';
create index reserva_plan_idx on public.reserva (plan_alumno_id, estado);

-- ---------------------------------------------------------------------
-- Saldo de sesiones por plan (RN-05, RN-06, HU-10, HU-22).
-- Descuentan: reservada, asistio, ausente_injustificada.
-- No descuentan: cancelada, ausente_justificada.
-- ---------------------------------------------------------------------
create view public.plan_saldo
with (security_invoker = true)
as
select
  pa.id                                   as plan_alumno_id,
  pa.alumno_id,
  pa.modalidad,
  pa.fecha_inicio,
  pa.fecha_fin_efectiva,
  pa.extendido,
  pa.sesiones_totales,
  coalesce(u.usadas, 0)                   as sesiones_usadas,
  greatest(pa.sesiones_totales - coalesce(u.usadas, 0), 0) as sesiones_disponibles,
  (current_date between pa.fecha_inicio and pa.fecha_fin_efectiva) as en_periodo
from public.plan_alumno pa
left join lateral (
  select count(*)::integer as usadas
  from public.reserva r
  where r.plan_alumno_id = pa.id
    and r.estado in ('reservada', 'asistio', 'ausente_injustificada')
) u on true;
comment on view public.plan_saldo is 'Saldo calculado de cada plan. security_invoker: respeta el RLS de quien consulta.';

-- ---------------------------------------------------------------------
-- RLS activado en todas las tablas (políticas en HU-3).
-- ---------------------------------------------------------------------
alter table public.personal         enable row level security;
alter table public.alumno           enable row level security;
alter table public.tipo_plan        enable row level security;
alter table public.plan_alumno      enable row level security;
alter table public.plantilla_bloque enable row level security;
alter table public.clase            enable row level security;
alter table public.reserva          enable row level security;
