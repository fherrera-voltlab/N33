import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Cliente único (singleton) reutilizado entre llamadas para no reabrir
// conexiones innecesariamente en cada request.
let client: SupabaseClient | null = null

// Creación diferida: evita que el build falle cuando las variables
// de entorno no están definidas (solo se necesitan en tiempo de ejecución).
export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  }
  return client
}
