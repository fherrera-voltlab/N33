'use client'

import { useState, useEffect } from 'react'

// Clave simple de acceso al panel (no es auth real, solo un filtro básico
// para que no cualquiera entre al dashboard). Configurable por env var.
const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE ?? '2222'

// Forma de cada registro de la tabla `publicaciones_log` en Supabase
// (ver lib/log.ts), tal como lo devuelve GET /api/logs
interface LogEntry {
  id: string
  created_at: string
  status: 'success' | 'error'
  title: string | null
  wp_url: string | null
  error_message: string | null
  error_step: string | null
}

// Forma reducida de una nota de WordPress, tal como la devuelve
// GET /api/posts (subset de campos que necesita la UI de administración)
interface PostItem {
  id: number
  title: string
  date: string
  link: string
  thumbnail: string | null
}

// Formatea fechas ISO al formato local es-MX; lo usan tanto el historial
// de logs como el listado de notas.
const formatDate = (iso: string) => new Date(iso).toLocaleString('es-MX', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

// Componente raíz del panel: controla el "gate" de acceso por clave y,
// una vez autenticado, delega toda la UI real en <Dashboard>.
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)

  // Pantalla de login por clave: no hay backend de auth, solo se compara
  // contra ADMIN_CODE en el cliente. Mientras no esté autenticado, se
  // muestra este formulario en lugar del dashboard.
  if (!authed) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Resplandores decorativos de fondo */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative bg-gray-900/80 backdrop-blur border border-gray-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-5 bg-gray-800 border border-gray-700 rounded-2xl flex items-center justify-center">
          <img src="https://noticias33.com/wp-content/uploads/2026/04/cropped-Captura-de-pantalla-2026-04-21-164553-69x47.png"
            alt="N33" className="h-8" />
        </div>
        <h1 className="text-white text-2xl font-bold text-center">Panel de Administración</h1>
        <p className="text-gray-500 text-sm text-center mt-1 mb-8">Gestioná publicaciones, notas y errores</p>

        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Clave de acceso
        </label>
        <input
          type="password"
          placeholder="••••••••"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (code === ADMIN_CODE) setAuthed(true)
              else setCodeError(true)
            }
          }}
          className={`w-full bg-gray-800/80 text-white rounded-xl px-4 py-3 outline-none border-2 tracking-widest placeholder-gray-600
            ${codeError ? 'border-red-500' : 'border-gray-700/60'} focus:border-teal-500 transition`}
        />
        {codeError && <p className="text-red-400 text-sm mt-2">Clave incorrecta, intentá de nuevo</p>}
        <button
          onClick={() => {
            if (code === ADMIN_CODE) setAuthed(true)
            else setCodeError(true)
          }}
          className="w-full mt-6 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 
            text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-teal-900/40"
        >
          Ingresar
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-600 text-xs">o</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>
        <a href="/publicar"
          className="block text-center text-gray-400 hover:text-white text-sm transition">
          Ir al Portal de Redacción →
        </a>
        <a href="https://noticias33.com/" target="_blank" rel="noopener noreferrer"
          className="block text-center text-teal-400/80 hover:text-teal-300 text-sm mt-3 transition">
          Visitar Noticias33.com ↗
        </a>
      </div>
    </div>
  )

  return <Dashboard onLogout={() => { setAuthed(false); setCode('') }} />
}

// Dashboard principal ya autenticado. Antes alternaba entre 3 pestañas
// (publicaciones / errores / notas); ahora se ven las 2 fuentes de datos
// juntas en un dash de 2 columnas: a la izquierda las notas publicadas en
// WordPress (<NotasPanel>, vía /api/posts), a la derecha el historial de
// publicaciones/errores de Supabase (<HistorialPanel>, vía /api/logs, con
// un filtro Todos/Éxito/Error en vez de una pestaña aparte).
function Dashboard({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-semibold text-gray-200">Panel de Administración</h1>
          <a href="/publicar"
            className="ml-auto text-gray-500 hover:text-white text-sm px-3 py-2 rounded-xl hover:bg-gray-900 transition">
            Portal de Redacción
          </a>
          <button
            onClick={onLogout}
            className="text-gray-500 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-900 transition"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <NotasPanel />
          <HistorialPanel />
        </div>

      </div>
    </div>
  )
}

// ── Historial de publicaciones/errores ────────────────────────
// Panel que lee GET /api/logs (tabla publicaciones_log de Supabase) y
// reemplaza lo que antes eran 2 pestañas separadas (Publicaciones/Errores)
// por un único listado con un filtro de status (Todos/Éxito/Error) y
// rango de fechas opcional.
function HistorialPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  // null = sin filtrar por status (todos); si no, se manda tal cual a /api/logs
  const [status, setStatus] = useState<'success' | 'error' | null>(null)
  // Rango de fechas opcional para filtrar el historial (formato yyyy-mm-dd
  // de <input type="date">, se manda tal cual como query params).
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Trae el historial de logs desde Supabase (GET /api/logs) filtrado por
  // el status activo y, si están definidos, por rango de fechas.
  const fetchLogs = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    fetch(`/api/logs?${params}`)
      .then(r => r.json())
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  // Refresca los logs cada vez que se cambia el filtro de status.
  useEffect(fetchLogs, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 md:p-6">
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Historial</h2>

      {/* Filtro de status */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setStatus(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition
            ${status === null ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setStatus('success')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition
            ${status === 'success' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
        >
          Publicaciones
        </button>
        <button
          onClick={() => setStatus('error')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition
            ${status === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
        >
          Errores
        </button>
      </div>

      {/* Filtros de fecha */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Desde</label>
          <input
            type="date" value={from}
            onChange={e => setFrom(e.target.value)}
            className="bg-gray-900 rounded-xl px-3 py-2 text-sm outline-none border-2 border-transparent focus:border-blue-500 transition"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input
            type="date" value={to}
            onChange={e => setTo(e.target.value)}
            className="bg-gray-900 rounded-xl px-3 py-2 text-sm outline-none border-2 border-transparent focus:border-blue-500 transition"
          />
        </div>
        <button
          onClick={fetchLogs}
          className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl text-sm transition"
        >
          Filtrar
        </button>
        {(from || to) && (
          <button
            onClick={() => { setFrom(''); setTo(''); fetchLogs() }}
            className="text-gray-500 hover:text-white text-sm transition px-2"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500 text-sm">No hay registros{(from || to) ? ' en ese rango de fechas' : ''}.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="bg-gray-900 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-medium text-gray-200">
                    {log.title || <span className="text-gray-500 italic">Sin título</span>}
                  </p>
                  {log.status === 'success' && log.wp_url && (
                    <a href={log.wp_url} target="_blank"
                      className="text-teal-300 hover:text-teal-200 text-sm transition">
                      Ver nota publicada →
                    </a>
                  )}
                  {log.status === 'error' && (
                    <div className="mt-1">
                      {log.error_step && (
                        <span className="inline-block bg-red-900/60 text-red-300 text-xs px-2 py-0.5 rounded-full mr-2">
                          Paso: {log.error_step}
                        </span>
                      )}
                      <p className="text-red-400 text-sm mt-1">{log.error_message}</p>
                    </div>
                  )}
                </div>
                <span className="text-gray-500 text-xs whitespace-nowrap">{formatDate(log.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Notas de muestra para previsualizar la interfaz cuando no hay
// conexión a WordPress (solo se usan en desarrollo)
const DEMO_POSTS: PostItem[] = [
  { id: -1, title: '(Ejemplo) Argentina avanza en energías renovables', date: new Date().toISOString(), link: '#', thumbnail: null },
  { id: -2, title: '(Ejemplo) Nueva ley de medios entra en vigencia', date: new Date(Date.now() - 86400000).toISOString(), link: '#', thumbnail: null },
  { id: -3, title: '(Ejemplo) El dólar cierra la semana estable', date: new Date(Date.now() - 172800000).toISOString(), link: '#', thumbnail: null },
]

// ── Notas publicadas: editar / eliminar ───────────────────────
// Panel que lista las notas reales tomadas directamente de WordPress
// (vía /api/posts, que a su vez pega contra la REST API de WP), con
// búsqueda por título, paginación y acciones de editar/eliminar.
// A diferencia del historial, esto no lee de Supabase.
function NotasPanel() {
  const [posts, setPosts] = useState<PostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  // Guarda el id del post que se está eliminando (no un booleano) para
  // poder deshabilitar solo el botón "Eliminar" de esa fila puntual.
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Pide las notas a WordPress a través de /api/posts, paginadas y con
  // búsqueda opcional por título. Si WordPress no responde (típico en
  // desarrollo local sin credenciales configuradas), en dev se muestran
  // notas de ejemplo (DEMO_POSTS) para poder seguir trabajando en la UI;
  // en producción se muestra un mensaje de error real en su lugar.
  const fetchPosts = (p: number, s: string) => {
    setLoading(true)
    setErrorMsg('')
    const params = new URLSearchParams({ page: String(p) })
    if (s.trim()) params.set('search', s.trim())
    fetch(`/api/posts?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.error || !Array.isArray(data.posts)) throw new Error()
        setPosts(data.posts)
        setTotalPages(data.totalPages ?? 1)
      })
      .catch(() => {
        if (process.env.NODE_ENV === 'development') {
          setErrorMsg('Sin conexión a WordPress: mostrando notas de ejemplo (solo visible en desarrollo).')
          setPosts(DEMO_POSTS)
          setTotalPages(1)
        } else {
          setErrorMsg('Error al cargar las notas')
        }
      })
      .finally(() => setLoading(false))
  }

  // Recarga solo al cambiar de página; el término de búsqueda se aplica
  // manualmente con `buscar()` (por eso se excluye `search` de las deps).
  useEffect(() => { fetchPosts(page, search) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dispara una nueva búsqueda desde la página 1 (evita quedar en una
  // página que ya no existe para los nuevos resultados filtrados)
  const buscar = () => {
    setPage(1)
    fetchPosts(1, search)
  }

  // Elimina (envía a la papelera de WordPress) una nota, con confirmación
  // previa del usuario porque es una acción destructiva. Llama a
  // DELETE /api/posts/[id] y, si sale bien, refresca la lista actual.
  const handleDelete = async (post: PostItem) => {
    if (!window.confirm(`¿Eliminar la nota "${post.title}"?\nSe enviará a la papelera de WordPress.`)) return
    setDeletingId(post.id)
    setErrorMsg('')
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? 'Error al eliminar la nota')
      fetchPosts(page, search)
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 md:p-6">
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Notas publicadas</h2>

      {/* Buscador */}
      <div className="flex gap-2 mb-4">
        <input
          type="text" placeholder="Buscar por título..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          className="flex-1 bg-gray-900 rounded-xl px-4 py-2 text-sm placeholder-gray-600
            outline-none border-2 border-transparent focus:border-blue-500 transition"
        />
        <button
          onClick={buscar}
          className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl text-sm transition"
        >
          Buscar
        </button>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
          {errorMsg}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-gray-500 text-sm">Cargando notas...</p>
      ) : posts.length === 0 ? (
        <p className="text-gray-500 text-sm">No se encontraron notas.</p>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <div key={post.id} className="bg-gray-900 rounded-xl px-3 py-3">
              <div className="flex items-start gap-3">
                {/* Miniatura de la imagen destacada (o un ícono si no tiene) */}
                <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center">
                  {post.thumbnail
                    ? <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                    : <span className="text-gray-600 text-xl">📰</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-200 truncate"
                    dangerouslySetInnerHTML={{ __html: post.title || '<span class="italic text-gray-500">Sin título</span>' }} />
                  <p className="text-gray-500 text-xs mt-0.5">{formatDate(post.date)}</p>
                  <div className="flex gap-2 mt-2">
                    <a href={post.link} target="_blank"
                      className="text-teal-300 hover:text-teal-200 text-sm px-2 py-1 transition">
                      Ver
                    </a>
                    <a href={`/publicar?editar=${post.id}`}
                      className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-1 rounded-lg transition">
                      Editar
                    </a>
                    <button
                      onClick={() => handleDelete(post)}
                      disabled={deletingId === post.id}
                      className="bg-red-900/50 hover:bg-red-800 text-red-300 text-sm px-3 py-1 rounded-lg
                        transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === post.id ? '...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-xl text-sm transition
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>
          <span className="text-gray-500 text-sm">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-xl text-sm transition
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}