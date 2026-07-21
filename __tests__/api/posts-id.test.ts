import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '@/app/api/posts/[id]/route'
import { logPublicacion } from '@/lib/log'

jest.mock('../../lib/log')

const mockedLogPublicacion = logPublicacion as jest.MockedFunction<typeof logPublicacion>

describe('/api/posts/[id]', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
    mockedLogPublicacion.mockReset()
    mockedLogPublicacion.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET', () => {
    it('camino feliz: resuelve tags y featured media, y devuelve el post aplanado', async () => {
      const wpPost = {
        id: 1,
        title: { raw: 'Titulo raw' },
        excerpt: { raw: 'Excerpt raw' },
        content: { raw: 'Content raw' },
        categories: [3],
        tags: [1, 2],
        featured_media: 7,
        link: 'https://cms.test.local/titulo-raw',
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce(new Response(JSON.stringify(wpPost), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify([{ id: 1, name: 'Tag1' }, { id: 2, name: 'Tag2' }]), {
            status: 200,
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ source_url: 'https://img' }), { status: 200 })
        )

      const response = await GET(new NextRequest('http://localhost/api/posts/1'), {
        params: { id: '1' },
      })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({
        id: 1,
        title: 'Titulo raw',
        excerpt: 'Excerpt raw',
        content: 'Content raw',
        categoryId: 3,
        tags: ['Tag1', 'Tag2'],
        featuredMediaId: 7,
        featuredMediaUrl: 'https://img',
        link: 'https://cms.test.local/titulo-raw',
      })

      expect(global.fetch).toHaveBeenCalledTimes(3)
      const tagsUrl = (global.fetch as jest.Mock).mock.calls[1][0] as string
      const mediaUrl = (global.fetch as jest.Mock).mock.calls[2][0] as string
      expect(tagsUrl).toContain('/tags?include=1,2')
      expect(mediaUrl).toContain('/media/7')
    })

    it('sin tags ni featured_media: no hace llamadas extra (fetch solo 1 vez)', async () => {
      const wpPost = {
        id: 2,
        title: { raw: 'Sin tags' },
        excerpt: { raw: '' },
        content: { raw: '' },
        categories: [],
        tags: [],
        featured_media: 0,
        link: 'https://cms.test.local/sin-tags',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(wpPost), { status: 200 })
      )

      const response = await GET(new NextRequest('http://localhost/api/posts/2'), {
        params: { id: '2' },
      })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.tags).toEqual([])
      expect(body.featuredMediaUrl).toBeNull()
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('si res.ok es false, devuelve {error} con el status de WordPress', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'No existe' }), { status: 404 })
      )

      const response = await GET(new NextRequest('http://localhost/api/posts/999'), {
        params: { id: '999' },
      })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body).toEqual({ error: { message: 'No existe' } })
    })

    it('si fetch tira excepción, devuelve 500 {error: "Error interno"}', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'))

      const response = await GET(new NextRequest('http://localhost/api/posts/1'), {
        params: { id: '1' },
      })
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body).toEqual({ error: 'Error interno' })
    })
  })

  describe('PUT', () => {
    const makeRequest = (payload: Record<string, unknown>) =>
      new NextRequest('http://localhost/api/posts/1', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

    it('camino feliz: actualiza, loggea éxito con prefijo [Editada] y responde con url/id', async () => {
      const updatedPost = { id: 1, link: 'https://cms.test.local/nota-editada' }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(updatedPost), { status: 200 })
      )

      const payload = {
        title: 'Nota editada',
        excerpt: 'Excerpt',
        content: 'Content',
        categoryId: 5,
        tags: [1, 2],
        featuredMediaId: 9,
      }

      const response = await PUT(makeRequest(payload), { params: { id: '1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({ url: 'https://cms.test.local/nota-editada', id: 1 })

      expect(global.fetch).toHaveBeenCalledTimes(1)
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toContain('/wp-json/wp/v2/posts/1')
      expect(options.method).toBe('POST')
      const sentBody = JSON.parse(options.body)
      expect(sentBody.categories).toEqual([5])

      expect(mockedLogPublicacion).toHaveBeenCalledWith({
        status: 'success',
        title: '[Editada] Nota editada',
        wp_url: 'https://cms.test.local/nota-editada',
      })
    })

    it('si WP responde error, loggea status error/editar y devuelve el status de WP', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'No se pudo editar' }), { status: 400 })
      )

      const response = await PUT(
        makeRequest({ title: 'Nota fallida', categoryId: 1, tags: [], featuredMediaId: 0 }),
        { params: { id: '1' } }
      )
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ error: { message: 'No se pudo editar' } })

      expect(mockedLogPublicacion).toHaveBeenCalledWith({
        status: 'error',
        title: 'Nota fallida',
        error_message: 'No se pudo editar',
        error_step: 'editar',
      })
    })

    it('si fetch tira excepción, loggea error/editar y devuelve 500', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('red caída'))

      const response = await PUT(
        makeRequest({ title: 'Nota con excepcion', categoryId: 1, tags: [], featuredMediaId: 0 }),
        { params: { id: '1' } }
      )
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body).toEqual({ error: 'Error interno' })

      expect(mockedLogPublicacion).toHaveBeenCalledWith({
        status: 'error',
        title: 'Nota con excepcion',
        error_message: 'red caída',
        error_step: 'editar',
      })
    })
  })

  describe('DELETE', () => {
    it('camino feliz: elimina, loggea éxito con prefijo [Eliminada] y responde {ok:true}', async () => {
      const deletedPost = { title: { rendered: 'Nota eliminada' } }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(deletedPost), { status: 200 })
      )

      const response = await DELETE(new NextRequest('http://localhost/api/posts/1', { method: 'DELETE' }), {
        params: { id: '1' },
      })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({ ok: true })

      expect(global.fetch).toHaveBeenCalledTimes(1)
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toContain('/wp-json/wp/v2/posts/1')
      expect(options.method).toBe('DELETE')

      expect(mockedLogPublicacion).toHaveBeenCalledWith({
        status: 'success',
        title: '[Eliminada] Nota eliminada',
      })
    })

    it('si WP responde error, loggea error/eliminar sin title', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'No se pudo eliminar' }), { status: 403 })
      )

      const response = await DELETE(new NextRequest('http://localhost/api/posts/1', { method: 'DELETE' }), {
        params: { id: '1' },
      })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body).toEqual({ error: { message: 'No se pudo eliminar' } })

      expect(mockedLogPublicacion).toHaveBeenCalledWith({
        status: 'error',
        error_message: 'No se pudo eliminar',
        error_step: 'eliminar',
      })
      const loggedArgs = mockedLogPublicacion.mock.calls[0][0]
      expect(loggedArgs).not.toHaveProperty('title')
    })

    it('si fetch tira excepción, loggea error/eliminar y devuelve 500', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('timeout'))

      const response = await DELETE(new NextRequest('http://localhost/api/posts/1', { method: 'DELETE' }), {
        params: { id: '1' },
      })
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body).toEqual({ error: 'Error interno' })

      expect(mockedLogPublicacion).toHaveBeenCalledWith({
        status: 'error',
        error_message: 'timeout',
        error_step: 'eliminar',
      })
    })
  })
})
