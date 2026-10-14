import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-orange-300',
  secundario: 'bg-white text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-50 disabled:text-zinc-400',
  peligro: 'bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:text-rose-300',
  fantasma: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
}

export function Boton({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
      {...props}
    />
  )
}

export function Campo({
  etiqueta,
  ayuda,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-zinc-700">{etiqueta}</span>
      <input
        className="mt-1 block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
        {...props}
      />
      {ayuda && <span className="mt-1 block text-xs text-zinc-500">{ayuda}</span>}
    </label>
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-6 ${className}`}>{children}</section>
}

export function Aviso({ tipo, children }: { tipo: 'error' | 'exito' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'bg-rose-50 text-rose-800 ring-rose-200',
    exito: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    info: 'bg-zinc-50 text-zinc-700 ring-zinc-200',
  }[tipo]
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3.5 py-2.5 text-sm ring-1 ${estilos}`}>
      {children}
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-zinc-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-orange-600" aria-hidden />
      {texto}
    </div>
  )
}

export function Interruptor({
  activo,
  onCambiar,
  etiqueta,
  deshabilitado,
}: {
  activo: boolean
  onCambiar: (valor: boolean) => void
  etiqueta: string
  deshabilitado?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={deshabilitado}
      onClick={() => onCambiar(!activo)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-50 ${
        activo ? 'bg-orange-600' : 'bg-zinc-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  )
}
