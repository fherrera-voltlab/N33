import { NextRequest } from 'next/server'
import { POST } from '@/app/api/media/route'
import { logPublicacion } from '@/lib/log'

// jest.mock('@/lib/log') falla al resolver el alias en esta versión de Jest
// (mismo problema preexistente en posts-id.test.ts y publicar.test.ts);
// se usa la ruta relativa, igual que en __tests__/lib/log.test.ts.
jest.mock('../../lib/log')

function buildRequest(file?: File) {
  const form = new FormData()
  if (file) {
    form.set('file', file)
  }
  return new NextRequest('http://localhost/api/media', {
    method: 'POST',
    body: form,
  })
}

function buildFile() {
  return new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' })
}

describe('POST /api/media', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('devuelve 400 si no se recibió imagen, sin llamar a fetch', async () => {
    const res = await POST(buildRequest())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'No se recibió imagen' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sube la imagen y devuelve id y url en el camino feliz', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 42, source_url: 'https://img/foto.png' }), {
        status: 201,
      })
    )

    const res = await POST(buildRequest(buildFile()))
    const json = await res.json()

    expect(json).toEqual({ id: 42, url: 'https://img/foto.png' })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toMatch(/^Basic /)
    expect(options.headers['Content-Disposition']).toContain('foto.png')
  })

  it('loggea error y devuelve el status de WP si la respuesta no es ok', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Archivo inválido' }), { status: 415 })
    )

    const res = await POST(buildRequest(buildFile()))

    expect(res.status).toBe(415)
    expect(logPublicacion).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', error_step: 'media' })
    )
  })

  it('loggea error y devuelve 500 si fetch tira una excepción', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'))

    const res = await POST(buildRequest(buildFile()))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'Error al subir imagen' })
    expect(logPublicacion).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', error_step: 'media' })
    )
  })

  it('devuelve 500 sin llamar a fetch ni a logPublicacion si falta WP_URL', async () => {
    const original = process.env.WP_URL
    delete process.env.WP_URL

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(buildRequest(buildFile()))

    expect(res.status).toBe(500)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(logPublicacion).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    process.env.WP_URL = original
  })

  it('devuelve 500 sin llamar a fetch ni a logPublicacion si falta WP_USER', async () => {
    const original = process.env.WP_USER
    delete process.env.WP_USER

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(buildRequest(buildFile()))

    expect(res.status).toBe(500)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(logPublicacion).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    process.env.WP_USER = original
  })

  it('devuelve 500 sin llamar a fetch ni a logPublicacion si falta WP_APP_PASSWORD', async () => {
    const original = process.env.WP_APP_PASSWORD
    delete process.env.WP_APP_PASSWORD

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(buildRequest(buildFile()))

    expect(res.status).toBe(500)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(logPublicacion).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    process.env.WP_APP_PASSWORD = original
  })
})
