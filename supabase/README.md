# Base de datos (Supabase)

Proyecto Supabase: `mecktzqyemszzyxdofhz` (región São Paulo).

Las migraciones SQL viven en `supabase/migrations/` y se versionan en git. Nunca se cambia la base a mano desde el panel de Supabase sin dejar la migración correspondiente aquí.

| Archivo | Contenido |
|---|---|
| `migrations/20261014000000_modelo_inicial.sql` | Las 8 tablas del modelo ER, vista `plan_saldo` y RLS activado en todas |
| `migrations/20261014000100_auditoria.sql` | HU-4: tabla `auditoria` y trigger `auditar()` en las tablas de negocio |
| `migrations/20261014010000_permisos_rls.sql` | HU-3: permisos por rol y por usuario (políticas RLS) |
| `functions/gestionar-personal/` | HU-2: Edge Function que crea, desactiva y reactiva cuentas del personal |
| `seed.sql` | HU-5: catálogo de planes, 10 alumnos ficticios y planes asignados |
| `tests/` | Pruebas de migraciones, seed, permisos y de la función, con PGlite (corren con `npm test`) |

## Primer administrador (una sola vez)

Las cuentas se crean desde la pantalla **Personal** de la app, pero esa pantalla exige ser administrador. El primero se crea a mano:

1. Supabase → **Authentication → Users → Add user → Create new user**: correo, contraseña y marcar **Auto Confirm User**.
2. Supabase → **SQL Editor**:

   ```sql
   insert into public.personal (id, nombre, email, rol)
   select id, 'Nombre Apellido', email, 'admin'
   from auth.users
   where email = 'tu-correo@ejemplo.com';
   ```

## Desplegar la función de cuentas

```bash
npx supabase functions deploy gestionar-personal
```

## Convención

- Nombre: `AAAAMMDDHHMMSS_descripcion.sql`.
- Una migración por cambio lógico. Una migración ya aplicada no se edita: se crea otra que la corrija.
- Toda tabla nueva lleva Row Level Security activado (RNF-03) y su trigger de auditoría (RNF-04).
- Solo datos ficticios hasta que exista el acuerdo de datos con el gimnasio (D8).

## Aplicar a Supabase

Desde la carpeta del repositorio, en tu computador:

```bash
npx supabase login                                    # abre el navegador
npx supabase link --project-ref mecktzqyemszzyxdofhz  # pide la contraseña de la base
npx supabase db push --include-seed                   # aplica migraciones y seed
```

`db push` aplica solo las migraciones que faltan y las registra en Supabase, así la próxima vez no se repiten. El seed es idempotente: volver a ejecutarlo no duplica datos.

## Probar localmente

```bash
npm test
```

Las pruebas levantan un Postgres en memoria (PGlite), aplican todas las migraciones y el seed, y verifican auditoría, idempotencia, RLS y el cálculo de saldo.
