# Workhard Concón · Gestión de clases

Herramienta web interna para instructores y administración de la sede Concón de Workhard: agenda del día con control de aforo, alumnos, planes y saldo automático de sesiones.

Documentación del proyecto (requisitos, backlog y registro de sesiones): Notion «Workhard Concón · Plataforma de gestión de clases».

## Stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS.
- **Datos y acceso:** Supabase (Postgres, Auth, Row Level Security). Región São Paulo.
- **Hosting:** Cloudflare Pages, con despliegue automático desde `main`.

## Desarrollo local

Requiere Node 22.

```bash
npm install
cp .env.example .env.local   # completar URL y clave pública de Supabase
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run lint` | Revisión de código (oxlint) |
| `npm run build` | Build de producción en `dist/` |

## Variables de entorno

| Variable | Dónde se obtiene |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → clave **publishable** (o la `anon` heredada) |

Todo lo que empieza con `VITE_` queda dentro del código que descarga el navegador. Por eso solo va la clave pública; la app se niega a arrancar si detecta una secret key o una service_role.

## Despliegue (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`
- Variables: las dos de la tabla anterior, más `NODE_VERSION=22`.

Cada push a `main` despliega automáticamente.

## Base de datos

Ver [`supabase/README.md`](supabase/README.md).
