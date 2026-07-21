import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { GET } from '@/app/api/logs/route'

jest.mock('../../lib/supabase')

const mockedGetSupabaseAdmin = getSupabaseAdmin as jest.MockedFunction<typeof getSupabaseAdmin>

// Construye un "query object" encadenable: cada método (from/select/order/
// eq/gte/lte) devuelve el mismo objeto, y el objeto es then-able para que
// `await query` resuelva con { data, error } sin importar cuántos métodos
// se hayan encadenado antes.
function buildQueryMock(result: { data: any; error: any }) {
  const query: any = {}
  ;['from', 'select', 'order', 'eq', 'gte', 'lte'].forEach((method) => {
    query[method] = jest.fn(() => query)
  })
  query.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return query
}

describe('GET /api/logs', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('sin filtros: devuelve el array de datos tal cual, sin llamar a eq/gte/lte', async () => {
    const FAKE_DATA = [
      { id: 1, status: 'success', created_at: '2026-01-01' },
      { id: 2, status: 'error', created_at: '2026-01-02' },
    ]
    const query = buildQueryMock({ data: FAKE_DATA, error: null })
    mockedGetSupabaseAdmin.mockReturnValue({ from: query.from } as any)

    const req = new NextRequest('http://localhost/api/logs')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(FAKE_DATA)
    expect(query.from).toHaveBeenCalledWith('publicaciones_log')
    expect(query.select).toHaveBeenCalledWith('*')
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(query.eq).not.toHaveBeenCalled()
    expect(query.gte).not.toHaveBeenCalled()
    expect(query.lte).not.toHaveBeenCalled()
  })

  it('con status=error: llama a .eq("status", "error")', async () => {
    const query = buildQueryMock({ data: [], error: null })
    mockedGetSupabaseAdmin.mockReturnValue({ from: query.from } as any)

    const req = new NextRequest('http://localhost/api/logs?status=error')
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('status', 'error')
    expect(query.gte).not.toHaveBeenCalled()
    expect(query.lte).not.toHaveBeenCalled()
  })

  it('con from y to: llama a .gte("created_at", from) y .lte("created_at", to)', async () => {
    const query = buildQueryMock({ data: [], error: null })
    mockedGetSupabaseAdmin.mockReturnValue({ from: query.from } as any)

    const req = new NextRequest(
      'http://localhost/api/logs?from=2026-01-01&to=2026-02-01'
    )
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(query.gte).toHaveBeenCalledWith('created_at', '2026-01-01')
    expect(query.lte).toHaveBeenCalledWith('created_at', '2026-02-01')
    expect(query.eq).not.toHaveBeenCalled()
  })

  it('si Supabase devuelve error, responde 500 con { error: message }', async () => {
    const query = buildQueryMock({ data: null, error: { message: 'boom' } })
    mockedGetSupabaseAdmin.mockReturnValue({ from: query.from } as any)

    const req = new NextRequest('http://localhost/api/logs')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'boom' })
  })

  it('si getSupabaseAdmin() tira (faltan env vars), responde 500 con un JSON de error', async () => {
    const envError = new Error(
      'Faltan variables de entorno de Supabase (SUPABASE_URL/SUPABASE_SERVICE_KEY)'
    )
    mockedGetSupabaseAdmin.mockImplementation(() => {
      throw envError
    })

    const req = new NextRequest('http://localhost/api/logs')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: envError.message })
  })
})
