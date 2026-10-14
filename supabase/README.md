# Base de datos (Supabase)

Proyecto Supabase: `mecktzqyemszzyxdofhz` (región São Paulo).

Las migraciones SQL viven en `supabase/migrations/` y se versionan en git. Nunca se cambia la base a mano desde el panel de Supabase sin dejar la migración correspondiente aquí.

| Archivo | Contenido |
|---|---|
| `migrations/20261014000000_modelo_inicial.sql` | Las 8 tablas del modelo ER, vista `plan_saldo` y RLS activado en todas |
| `migrations/20261014000100_auditoria.sql` | HU-4: tabla `auditoria` y trigger `auditar()` en las tablas de negocio |
| `seed.sql` | HU-5: catálogo de planes, 10 alumnos ficticios y planes asignados |
| `tests/db.test.ts` | Pruebas de las migraciones y del seed con PGlite (corren con `npm test`) |

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
