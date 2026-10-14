import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { SesionProvider } from './auth/SesionProvider'
import Layout, { SoloAdmin } from './components/Layout'
import { supabaseSetup } from './lib/supabase'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import Personal from './pages/Personal'

function ErrorConfiguracion({ mensaje }: { mensaje: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-rose-200" role="alert">
        <p className="text-xs font-semibold tracking-widest text-rose-600 uppercase">Configuración incompleta</p>
        <p className="mt-2 text-sm text-zinc-700">{mensaje}</p>
      </div>
    </main>
  )
}

export default function App() {
  if (!supabaseSetup.ok) return <ErrorConfiguracion mensaje={supabaseSetup.error} />

  return (
    <SesionProvider client={supabaseSetup.client}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            <Route
              path="personal"
              element={
                <SoloAdmin>
                  <Personal />
                </SoloAdmin>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  )
}
