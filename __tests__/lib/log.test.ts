import { getSupabaseAdmin } from '@/lib/supabase'
import { logPublicacion } from '@/lib/log'

jest.mock('../../lib/supabase')

const mockedGetSupabaseAdmin = getSupabaseAdmin as jest.MockedFunction<typeof getSupabaseAdmin>

describe('lib/log', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('logPublicacion - camino feliz', () => {
    it('llama a from("publicaciones_log") e insert con los datos exactos (status success)', async () => {
      const insertMock = jest.fn().mockResolvedValue({ error: null })
      const fromMock = jest.fn(() => ({ insert: insertMock }))
      mockedGetSupabaseAdmin.mockReturnValue({ from: fromMock } as any)

      const data = { status: 'success' as const, title: 'X', wp_url: 'https://ejemplo.com/x' }
      await logPublicacion(data)

      expect(fromMock).toHaveBeenCalledWith('publicaciones_log')
      expect(insertMock).toHaveBeenCalledWith(data)
    })

    it('pasa tal cual los campos de error (status error, error_message, error_step)', async () => {
      const insertMock = jest.fn().mockResolvedValue({ error: null })
      const fromMock = jest.fn(() => ({ insert: insertMock }))
      mockedGetSupabaseAdmin.mockReturnValue({ from: fromMock } as any)

      const data = {
        status: 'error' as const,
        title: 'Nota fallida',
        error_message: 'Timeout al publicar',
        error_step: 'wp_create_post',
      }
      await logPublicacion(data)

      expect(fromMock).toHaveBeenCalledWith('publicaciones_log')
      expect(insertMock).toHaveBeenCalledWith(data)
    })
  })

  describe('logPublicacion - manejo de errores (no debe relanzar)', () => {
    it('no relanza si insert() rechaza, y loguea con console.error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const insertError = new Error('DB caída')
      const insertMock = jest.fn().mockRejectedValue(insertError)
      const fromMock = jest.fn(() => ({ insert: insertMock }))
      mockedGetSupabaseAdmin.mockReturnValue({ from: fromMock } as any)

      await expect(logPublicacion({ status: 'success', title: 'X' })).resolves.toBeUndefined()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error guardando log:', insertError)

      consoleErrorSpy.mockRestore()
    })

    it('no relanza si getSupabaseAdmin() tira (ej. faltan env vars de Supabase)', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const envError = new Error(
        'Faltan variables de entorno de Supabase (SUPABASE_URL/SUPABASE_SERVICE_KEY)'
      )
      mockedGetSupabaseAdmin.mockImplementation(() => {
        throw envError
      })

      await expect(logPublicacion({ status: 'error', error_message: 'x' })).resolves.toBeUndefined()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error guardando log:', envError)

      consoleErrorSpy.mockRestore()
    })
  })
})
