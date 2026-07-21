// Mockeamos el SDK de Supabase para no crear un cliente real: createClient
// devuelve un objeto fake que podemos identificar por referencia.
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ __fake: 'supabase-client' })),
}))

describe('lib/supabase', () => {
  const ORIGINAL_URL = process.env.SUPABASE_URL
  const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_KEY

  beforeEach(() => {
    // El singleton `client` vive a nivel de módulo: sin resetModules, un
    // test que ya haya creado el cliente contaminaría a los siguientes
    // (por ejemplo, el error de env vars faltantes dejaría de lanzarse).
    jest.resetModules()
  })

  afterEach(() => {
    process.env.SUPABASE_URL = ORIGINAL_URL
    process.env.SUPABASE_SERVICE_KEY = ORIGINAL_KEY
  })

  // Nota: se usa ruta relativa (no el alias '@/') porque el alias solo se
  // resuelve en imports estáticos transformados por next/jest; un
  // require() dinámico con '@/lib/supabase' falla con "Cannot find module".
  // Además, tras resetModules() hay que volver a requerir
  // '@supabase/supabase-js' en cada test: la instancia mockeada que exista
  // antes del reset queda "vieja" y no es la que lib/supabase usará.
  function freshImports() {
    const { createClient } = require('@supabase/supabase-js')
    const { getSupabaseAdmin } = require('../../lib/supabase')
    return { createClient: createClient as jest.Mock, getSupabaseAdmin }
  }

  it('crea el cliente en la primera llamada con las env vars correctas', () => {
    const { createClient, getSupabaseAdmin } = freshImports()

    const result = getSupabaseAdmin()

    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith(
      'https://supabase.test.local',
      'test-service-key'
    )
    expect(result).toEqual({ __fake: 'supabase-client' })
  })

  it('devuelve el mismo objeto (singleton) en llamadas sucesivas sin volver a llamar a createClient', () => {
    const { createClient, getSupabaseAdmin } = freshImports()

    const first = getSupabaseAdmin()
    const second = getSupabaseAdmin()

    expect(first).toBe(second)
    expect(createClient).toHaveBeenCalledTimes(1)
  })

  it('tira error si falta SUPABASE_URL', () => {
    delete process.env.SUPABASE_URL

    const { createClient, getSupabaseAdmin } = freshImports()

    expect(() => getSupabaseAdmin()).toThrow(
      'Faltan variables de entorno de Supabase (SUPABASE_URL/SUPABASE_SERVICE_KEY)'
    )
    expect(createClient).not.toHaveBeenCalled()
  })

  it('tira error si falta SUPABASE_SERVICE_KEY', () => {
    delete process.env.SUPABASE_SERVICE_KEY

    const { createClient, getSupabaseAdmin } = freshImports()

    expect(() => getSupabaseAdmin()).toThrow(
      'Faltan variables de entorno de Supabase (SUPABASE_URL/SUPABASE_SERVICE_KEY)'
    )
    expect(createClient).not.toHaveBeenCalled()
  })
})
