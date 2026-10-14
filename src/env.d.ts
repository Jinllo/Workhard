interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Inyectada en el build desde WORKERS_CI_COMMIT_SHA o CF_PAGES_COMMIT_SHA (Cloudflare). */
  readonly VITE_COMMIT_SHA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
