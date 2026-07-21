import { NextRequest } from 'next/server'
import { POST } from '@/app/api/publicar/route'
import { logPublicacion } from '@/lib/log'

jest.mock('../../lib/log')

const mockedLogPublicacion = logPublicacion as jest.MockedFunction<typeof logPublicacion>

describe('POST /api/publicar', () => {
  const originalFetch = global.fetch

  const body = {
    title: 'Mi nota',
    excerpt: 'Resumen',
    content: '<p>Contenido</p>',
    categoryId: 5,
    tags: [1, 2],
    featuredMediaId: 99,
  }

  function makeRequest(payload: unknown = body) {
    return new NextRequest('http://localhost/api/publicar', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  beforeEach(() => {
    global.fetch = jest.fn()
    mockedLogPublicacion.mockReset()
    mockedLogPublicacion.mockResolvedValue(undefined)
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('camino feliz: crea la nota y devuelve url e id', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 10, link: 'https://sitio/nota' }), { status: 200 })
    )

    const req = makeRequest()
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ url: 'https://sitio/nota', id: 10 })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/wp-json/wp/v2/posts')
    expect(init.method).toBe('POST')
    const sentBody = JSON.parse(init.body)
    expect(sentBody.status).toBe('publish')
    expect(sentBody.categories).toEqual([body.categoryId])

    expect(logPublicacion).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        title: body.title,
        wp_url: 'https://sitio/nota',
      })
    )
  })

  it('si WordPress responde error (res.ok === false), loggea error y devuelve el mismo status', async () => {
    const wpError = { message: 'Error al publicar en WP' }
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(wpError), { status: 400 })
    )

    const req = makeRequest()
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: wpError })

    expect(logPublicacion).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        title: body.title,
        error_step: 'publicar',
      })
    )
  })

  it('si req.json() o fetch tiran excepción, devuelve 500 y loggea error sin asumir title', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    const req = makeRequest()
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'Error interno' })

    expect(logPublicacion).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error_step: 'publicar',
      })
    )
  })

  it('si falta una variable de entorno de WordPress, devuelve 500 sin llamar a fetch ni a logPublicacion', async () => {
    const original = process.env.WP_URL
    delete process.env.WP_URL

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const req = makeRequest()
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'Error interno' })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(logPublicacion).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    process.env.WP_URL = original
  })
})
