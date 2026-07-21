import { getSupabaseAdmin } from './supabase'

// Registra en Supabase (tabla "publicaciones_log") cada intento de
// publicar/editar/eliminar una nota en WordPress, sea éxito o error.
// Lo usan las rutas de app/api/* para armar el historial que se muestra
// en el panel de admin (app/admin/page.tsx).
export async function logPublicacion(data: {
  status: 'success' | 'error'
  title?: string
  wp_url?: string
  error_message?: string
  error_step?: string
}) {
  try {
    await getSupabaseAdmin().from('publicaciones_log').insert(data)
  } catch (err) {
    // Si falla el propio logging, solo se imprime en consola: no debe
    // interrumpir el flujo de publicación/edición que lo llamó.
    console.error('Error guardando log:', err)
  }
}