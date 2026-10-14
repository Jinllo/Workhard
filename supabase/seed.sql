-- =====================================================================
-- HU-5 · Datos ficticios de desarrollo (D8, RNF-08)
--
-- * NINGÚN dato corresponde a personas reales del gimnasio.
--   Teléfonos con formato +56 9 0000 00NN (no asignables) y correos @ejemplo.cl.
-- * Idempotente: IDs fijos + ON CONFLICT DO NOTHING. Ejecutarlo dos veces
--   deja exactamente el mismo resultado.
-- * Fechas relativas al día en que se ejecuta, para que siempre haya
--   planes vigentes, por vencer, vencidos y extendidos.
-- * El personal (instructores) se crea en HU-2, porque necesita cuentas de
--   acceso reales en Supabase Auth.
-- * 10 alumnos por decisión de José (14-10-2026), en vez de 250.
-- =====================================================================

-- Catálogo de planes -------------------------------------------------------
insert into public.tipo_plan (id, nombre, modalidad, sesiones, duracion_meses) values
  ('7a000000-0000-4000-8000-000000000008', 'Plan 8',  'general', 8,  1),
  ('7a000000-0000-4000-8000-000000000012', 'Plan 12', 'general', 12, 1),
  ('7a000000-0000-4000-8000-000000000016', 'Plan 16', 'general', 16, 1),
  ('7a000000-0000-4000-8000-000000000020', 'Plan 20', 'general', 20, 1),
  -- ⚠️ Tamaños de los planes 1-1 pendientes de confirmar con el encargado (F-02).
  ('7a000000-0000-4000-8000-000000000104', 'Plan 1-1 · 4 sesiones (provisional)', 'uno_a_uno', 4, 1),
  ('7a000000-0000-4000-8000-000000000108', 'Plan 1-1 · 8 sesiones (provisional)', 'uno_a_uno', 8, 1)
on conflict do nothing;

-- Alumnos ficticios ---------------------------------------------------------
insert into public.alumno (id, nombre, telefono, email, fecha_alta, estado, notas) values
  ('a1000000-0000-4000-8000-000000000001', 'Camila Rojas Ficticia',     '+56 9 0000 0001', 'camila.rojas@ejemplo.cl',    current_date - 120, 'activo',   'Dato ficticio de desarrollo'),
  ('a1000000-0000-4000-8000-000000000002', 'Matías Fuentes Ficticio',   '+56 9 0000 0002', null,                         current_date - 90,  'activo',   'Dato ficticio de desarrollo · plan por vencer'),
  ('a1000000-0000-4000-8000-000000000003', 'Valentina Soto Ficticia',   '+56 9 0000 0003', 'valentina.soto@ejemplo.cl',  current_date - 200, 'activo',   'Dato ficticio de desarrollo · plan general + 1-1'),
  ('a1000000-0000-4000-8000-000000000004', 'Benjamín Muñoz Ficticio',   '+56 9 0000 0004', null,                         current_date - 60,  'activo',   'Dato ficticio de desarrollo · plan extendido'),
  ('a1000000-0000-4000-8000-000000000005', 'Fernanda Castro Ficticia',  '+56 9 0000 0005', 'fernanda.castro@ejemplo.cl', current_date - 75,  'activo',   'Dato ficticio de desarrollo · plan vencido'),
  ('a1000000-0000-4000-8000-000000000006', 'Joaquín Herrera Ficticio',  '+56 9 0000 0006', null,                         current_date - 2,   'activo',   'Dato ficticio de desarrollo · sin plan'),
  ('a1000000-0000-4000-8000-000000000007', 'Isidora Pérez Ficticia',    '+56 9 0000 0007', 'isidora.perez@ejemplo.cl',   current_date - 300, 'inactivo', 'Dato ficticio de desarrollo · alumna inactiva'),
  ('a1000000-0000-4000-8000-000000000008', 'Tomás Vargas Ficticio',     '+56 9 0000 0008', null,                         current_date,       'activo',   'Dato ficticio de desarrollo · plan desde hoy'),
  ('a1000000-0000-4000-8000-000000000009', 'Antonia Silva Ficticia',    '+56 9 0000 0009', 'antonia.silva@ejemplo.cl',   current_date - 40,  'activo',   'Dato ficticio de desarrollo · solo 1-1'),
  ('a1000000-0000-4000-8000-000000000010', 'Diego Morales Ficticio',    '+56 9 0000 0010', null,                         current_date - 150, 'activo',   'Dato ficticio de desarrollo')
on conflict do nothing;

-- Planes asignados (la modalidad la completa el trigger) -------------------
insert into public.plan_alumno (id, alumno_id, tipo_plan_id, modalidad, fecha_inicio, fecha_fin, sesiones_totales,
                                extendido, fecha_fin_extendida, motivo_extension, extendido_en) values
  -- Vigentes
  ('b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000012', 'general',
     current_date - 5,  (current_date - 5  + interval '1 month')::date, 12, false, null, null, null),
  ('b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', '7a000000-0000-4000-8000-000000000008', 'general',
     current_date - 25, (current_date - 25 + interval '1 month')::date, 8,  false, null, null, null),
  ('b2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', '7a000000-0000-4000-8000-000000000016', 'general',
     current_date - 12, (current_date - 12 + interval '1 month')::date, 16, false, null, null, null),
  ('b2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003', '7a000000-0000-4000-8000-000000000104', 'uno_a_uno',
     current_date - 12, (current_date - 12 + interval '1 month')::date, 4,  false, null, null, null),
  ('b2000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000008', '7a000000-0000-4000-8000-000000000012', 'general',
     current_date,      (current_date      + interval '1 month')::date, 12, false, null, null, null),
  ('b2000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000009', '7a000000-0000-4000-8000-000000000108', 'uno_a_uno',
     current_date - 8,  (current_date - 8  + interval '1 month')::date, 8,  false, null, null, null),
  ('b2000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000010', '7a000000-0000-4000-8000-000000000016', 'general',
     current_date - 10, (current_date - 10 + interval '1 month')::date, 16, false, null, null, null),
  -- Extendido por enfermedad: el mes ya terminó, pero sigue vigente 7 días más
  ('b2000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000004', '7a000000-0000-4000-8000-000000000020', 'general',
     current_date - 33, (current_date - 33 + interval '1 month')::date, 20,
     true, (current_date - 33 + interval '1 month')::date + 7, 'enfermedad', now() - interval '3 days'),
  -- Vencido (sus sesiones no usadas se perdieron, RN-03)
  ('b2000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000005', '7a000000-0000-4000-8000-000000000008', 'general',
     current_date - 45, (current_date - 45 + interval '1 month')::date, 8,  false, null, null, null)
on conflict do nothing;
