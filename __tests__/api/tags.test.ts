import { NextRequest } from 'next/server'
import { GET } from '@/app/api/tags/route'

function buildRequest(name: string) {
  return new NextRequest('http://localhost/api/tags?name=' + encodeURIComponent(name))
}

describe('GET /api/tags', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('devuelve el id del tag existente y no crea uno nuevo (match exacto)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 5, name: 'Nombre Tag' }]))
    )

    const res = await GET(buildRequest('Nombre Tag'))
    const json = await res.json()

    expect(json).toEqual({ id: 5 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('matchea el tag existente sin importar mayúsculas/minúsculas', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 5, name: 'Nombre Tag' }]))
    )

    const res = await GET(buildRequest('nombre tag'))
    const json = await res.json()

    expect(json).toEqual({ id: 5 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('crea el tag si la búsqueda no devuelve resultados', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(JSON.stringify([])))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 9, name: 'Nombre Tag' }))
      )

    const res = await GET(buildRequest('Nombre Tag'))
    const json = await res.json()

    expect(json).toEqual({ id: 9 })
    expect(global.fetch).toHaveBeenCalledTimes(2)

    const [createUrl, createOptions] = (global.fetch as jest.Mock).mock.calls[1]
    expect(createUrl).toContain('/wp-json/wp/v2/tags')
    expect(createOptions.method).toBe('POST')
    expect(createOptions.headers.Authorization).toMatch(/^Basic /)
  })

  it('crea el tag si la búsqueda no devuelve un match exacto', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 1, name: 'Otro Tag Similar' }]))
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 9, name: 'Nombre Tag' }))
      )

    const res = await GET(buildRequest('Nombre Tag'))
    const json = await res.json()

    expect(json).toEqual({ id: 9 })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('devuelve 500 sin llamar a fetch si falta WP_URL', async () => {
    const original = process.env.WP_URL
    delete process.env.WP_URL

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(buildRequest('Nombre Tag'))

    expect(res.status).toBe(500)
    expect(global.fetch).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    process.env.WP_URL = original
  })

  it('devuelve 500 sin llamar a fetch si falta WP_USER', async () => {
    const original = process.env.WP_USER
    delete process.env.WP_USER

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(buildRequest('Nombre Tag'))

    expect(res.status).toBe(500)
    expect(global.fetch).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    process.env.WP_USER = original
  })

  it('devuelve 500 sin llamar a fetch si falta WP_APP_PASSWORD', async () => {
    const original = process.env.WP_APP_PASSWORD
    delete process.env.WP_APP_PASSWORD

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(buildRequest('Nombre Tag'))

    expect(res.status).toBe(500)
    expect(global.fetch).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    process.env.WP_APP_PASSWORD = original
  })
})
