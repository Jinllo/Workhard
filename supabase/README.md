# Base de datos (Supabase)

Las migraciones SQL viven en `supabase/migrations/` y se versionan en git. Nunca se cambia la base a mano desde el panel de Supabase sin dejar la migración correspondiente aquí.

## Convención

- Nombre: `AAAAMMDDHHMMSS_descripcion.sql` (por ejemplo, `20261014120000_modelo_inicial.sql`).
- Una migración por cambio lógico. Una migración ya aplicada no se edita: se crea otra que la corrija.
- Toda tabla nueva lleva Row Level Security activado (RNF-03) y su trigger de auditoría (RNF-04).

## Aplicar migraciones

Con la [CLI de Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started):

```bash
npx supabase login
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push
```

El `ref` es la parte de la URL del proyecto: `https://<ref>.supabase.co`.
