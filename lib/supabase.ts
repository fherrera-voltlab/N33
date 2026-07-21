import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Cliente único (singleton) reutilizado entre llamadas para no reabrir
// conexiones innecesariamente en cada request.
let client: SupabaseClient | null = null

// Creación diferida: evita que el build falle cuando las variables
// de entorno no están definidas (solo se necesitan en tiempo de ejecución).
export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY

    // Se valida acá (con un mensaje claro) en vez de dejar que
    // createClient falle más abajo con un error genérico: quien llame a
    // esta función debe envolver la llamada en try/catch para manejarlo.
    if (!url || !serviceKey) {
      throw new Error('Faltan variables de entorno de Supabase (SUPABASE_URL/SUPABASE_SERVICE_KEY)')
    }

    client = createClient(url, serviceKey)
  }
  return client
}
