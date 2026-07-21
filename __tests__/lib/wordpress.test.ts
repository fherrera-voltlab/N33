import { getWpUrl, getWpConfig } from '@/lib/wordpress'

describe('lib/wordpress', () => {
  describe('getWpUrl', () => {
    it('devuelve la URL cuando WP_URL está seteada', () => {
      expect(getWpUrl()).toBe('https://cms.test.local')
    })

    it('devuelve null si falta WP_URL', () => {
      const original = process.env.WP_URL
      delete process.env.WP_URL

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      expect(getWpUrl()).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      process.env.WP_URL = original
    })
  })

  describe('getWpConfig', () => {
    it('devuelve { url, authHeader } correctos con los valores dummy', () => {
      const config = getWpConfig()

      expect(config).not.toBeNull()
      expect(config?.url).toBe('https://cms.test.local')

      const expectedAuthHeader =
        'Basic ' + Buffer.from('test-user:test-app-password').toString('base64')
      expect(config?.authHeader).toBe(expectedAuthHeader)

      // Verifica que el authHeader decodifica correctamente en base64.
      const base64Part = config!.authHeader.replace('Basic ', '')
      const decoded = Buffer.from(base64Part, 'base64').toString('utf-8')
      expect(decoded).toBe('test-user:test-app-password')
    })

    it('devuelve null si falta WP_URL', () => {
      const original = process.env.WP_URL
      delete process.env.WP_URL

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      expect(getWpConfig()).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      process.env.WP_URL = original
    })

    it('devuelve null si falta WP_USER', () => {
      const original = process.env.WP_USER
      delete process.env.WP_USER

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      expect(getWpConfig()).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      process.env.WP_USER = original
    })

    it('devuelve null si falta WP_APP_PASSWORD', () => {
      const original = process.env.WP_APP_PASSWORD
      delete process.env.WP_APP_PASSWORD

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      expect(getWpConfig()).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      process.env.WP_APP_PASSWORD = original
    })
  })
})
