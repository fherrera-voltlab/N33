import { NextRequest } from 'next/server'
import { GET } from '@/app/api/posts/route'

describe('GET /api/posts', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  const wpPosts = [
    { id: 1, title: { rendered: 'Primera nota' }, date: '2026-01-01T10:00:00', link: 'https://cms.test.local/primera-nota' },
    { id: 2, title: { rendered: 'Segunda nota' }, date: '2026-01-02T10:00:00', link: 'https://cms.test.local/segunda-nota' },
  ]

  function mockWpResponse(body: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'X-WP-TotalPages': '3' },
      ...init,
    })
  }

  it('camino feliz: sin query params devuelve posts aplanados y totalPages del header', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockWpResponse(wpPosts))

    const req = new NextRequest('http://localhost/api/posts')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      posts: [
        { id: 1, title: 'Primera nota', date: '2026-01-01T10:00:00', link: 'https://cms.test.local/primera-nota', thumbnail: null },
        { id: 2, title: 'Segunda nota', date: '2026-01-02T10:00:00', link: 'https://cms.test.local/segunda-nota', thumbnail: null },
      ],
      totalPages: 3,
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('status=publish')
    expect(calledUrl).toContain('per_page=10')
    expect(calledUrl).toContain('page=1')
    expect(calledUrl).not.toContain('search=')
  })

  it('extrae la miniatura desde _embedded[wp:featuredmedia], priorizando el tamaño thumbnail', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockWpResponse([
      {
        id: 1,
        title: { rendered: 'Con imagen' },
        date: '2026-01-01T10:00:00',
        link: 'https://cms.test.local/con-imagen',
        _embedded: {
          'wp:featuredmedia': [{
            source_url: 'https://cms.test.local/imagen-full.jpg',
            media_details: { sizes: { thumbnail: { source_url: 'https://cms.test.local/imagen-thumb.jpg' } } },
          }],
        },
      },
      {
        id: 2,
        title: { rendered: 'Sin tamaño thumbnail' },
        date: '2026-01-02T10:00:00',
        link: 'https://cms.test.local/sin-thumb',
        _embedded: {
          'wp:featuredmedia': [{ source_url: 'https://cms.test.local/imagen-full-2.jpg', media_details: { sizes: {} } }],
        },
      },
    ]))

    const req = new NextRequest('http://localhost/api/posts')
    const res = await GET(req)
    const json = await res.json()

    expect(json.posts[0].thumbnail).toBe('https://cms.test.local/imagen-thumb.jpg')
    expect(json.posts[1].thumbnail).toBe('https://cms.test.local/imagen-full-2.jpg')

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('_embed=wp%3Afeaturedmedia')
  })

  it('con search=texto, incluye search en la URL de fetch a WordPress', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockWpResponse(wpPosts))

    const req = new NextRequest('http://localhost/api/posts?search=texto')
    await GET(req)

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('search=texto')
  })

  it('con page=2, incluye page=2 en la URL de fetch a WordPress', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockWpResponse(wpPosts))

    const req = new NextRequest('http://localhost/api/posts?page=2')
    await GET(req)

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('page=2')
  })

  it('si WordPress responde res.ok === false, devuelve error con el mismo status', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'no encontrado' }), { status: 404 })
    )

    const req = new NextRequest('http://localhost/api/posts')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'Error al obtener notas' })
  })

  it('si fetch rechaza (throw), devuelve 500 con error interno', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    const req = new NextRequest('http://localhost/api/posts')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'Error interno' })
  })

  it('si falta WP_URL, devuelve 500 sin llamar a fetch', async () => {
    const original = process.env.WP_URL
    delete process.env.WP_URL

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = jest.fn()

    const req = new NextRequest('http://localhost/api/posts')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'Error interno' })
    expect(global.fetch).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    process.env.WP_URL = original
  })

  it('si falta WP_USER, devuelve 500 sin llamar a fetch', async () => {
    const original = process.env.WP_USER
    delete process.env.WP_USER

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = jest.fn()

    const req = new NextRequest('http://localhost/api/posts')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'Error interno' })
    expect(global.fetch).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    process.env.WP_USER = original
  })

  it('si falta WP_APP_PASSWORD, devuelve 500 sin llamar a fetch', async () => {
    const original = process.env.WP_APP_PASSWORD
    delete process.env.WP_APP_PASSWORD

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = jest.fn()

    const req = new NextRequest('http://localhost/api/posts')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'Error interno' })
    expect(global.fetch).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    process.env.WP_APP_PASSWORD = original
  })
})
