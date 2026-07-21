import { GET } from '@/app/api/categorias/route'

describe('GET /api/categorias', () => {
  let originalWpUrl: string | undefined

  beforeEach(() => {
    originalWpUrl = process.env.WP_URL
    global.fetch = jest.fn()
  })

  afterEach(() => {
    process.env.WP_URL = originalWpUrl
    jest.restoreAllMocks()
  })

  it('camino feliz: excluye "uncategorized" (id 1) y devuelve solo {id, name}', async () => {
    const categoriesFromWp = [
      { id: 1, slug: 'uncategorized', name: 'Sin categoría', count: 0 },
      { id: 2, slug: 'noticias', name: 'Noticias', count: 5 },
      { id: 3, slug: 'deportes', name: 'Deportes', count: 3 },
    ]

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify(categoriesFromWp), {
        status: 200,
        headers: { 'X-WP-TotalPages': '1' },
      })
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([
      { id: 2, name: 'Noticias' },
      { id: 3, name: 'Deportes' },
    ])
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('paginación: junta los resultados de todas las páginas reportadas por X-WP-TotalPages', async () => {
    const page1 = [
      { id: 1, slug: 'uncategorized', name: 'Sin categoría' },
      { id: 2, slug: 'noticias', name: 'Noticias' },
    ]
    const page2 = [
      { id: 3, slug: 'deportes', name: 'Deportes' },
      { id: 4, slug: 'politica', name: 'Política' },
    ]

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page1), {
          status: 200,
          headers: { 'X-WP-TotalPages': '2' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page2), {
          status: 200,
          headers: { 'X-WP-TotalPages': '2' },
        })
      )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([
      { id: 2, name: 'Noticias' },
      { id: 3, name: 'Deportes' },
      { id: 4, name: 'Política' },
    ])

    expect(global.fetch).toHaveBeenCalledTimes(2)
    const firstUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    const secondUrl = (global.fetch as jest.Mock).mock.calls[1][0] as string
    expect(firstUrl).toContain('page=1')
    expect(secondUrl).toContain('page=2')
  })

  it('devuelve el mismo status y un error genérico si WordPress responde con res.ok=false', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'boom' }), {
        status: 500,
        headers: { 'X-WP-TotalPages': '1' },
      })
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Error al obtener categorías' })
  })

  it('devuelve 500 y "Error interno" si fetch rechaza (error de red)', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network error'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Error interno' })
  })

  it('devuelve 500 sin llamar a fetch si falta WP_URL', async () => {
    delete process.env.WP_URL

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Error interno' })
    expect(global.fetch).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})
