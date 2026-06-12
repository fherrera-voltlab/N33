'use client'

import { useState, useEffect } from 'react'

const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE ?? '2222'

interface LogEntry {
  id: string
  created_at: string
  status: 'success' | 'error'
  title: string | null
  wp_url: string | null
  error_message: string | null
  error_step: string | null
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)

  if (!authed) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <h1 className="text-white text-xl font-semibold text-center mb-6">Panel de Administración</h1>
        <input
          type="password"
          placeholder="Clave de acceso"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (code === ADMIN_CODE) setAuthed(true)
              else setCodeError(true)
            }
          }}
          className={`w-full bg-gray-800 text-white rounded-xl px-4 py-3 outline-none border-2 
            ${codeError ? 'border-red-500' : 'border-transparent'} focus:border-blue-500 transition`}
        />
        {codeError && <p className="text-red-400 text-sm mt-2 text-center">Clave incorrecta</p>}
        <button
          onClick={() => {
            if (code === ADMIN_CODE) setAuthed(true)
            else setCodeError(true)
          }}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition"
        >
          Ingresar
        </button>
      </div>
    </div>
  )

  return <Dashboard />
}

function Dashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'success' | 'error'>('success')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fetchLogs = () => {
    setLoading(true)
    const params = new URLSearchParams({ status: tab })
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    fetch(`/api/logs?${params}`)
      .then(r => r.json())
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLogs() }, [tab])

  const formatDate = (iso: string) => new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">

        <h1 className="text-xl font-semibold text-gray-200 mb-6">Panel de Administración</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('success')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition
              ${tab === 'success' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
          >
            Publicaciones
          </button>
          <button
            onClick={() => setTab('error')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition
              ${tab === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
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
    </div>
  )
}