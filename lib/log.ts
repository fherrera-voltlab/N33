import { supabaseAdmin } from './supabase'

export async function logPublicacion(data: {
  status: 'success' | 'error'
  title?: string
  wp_url?: string
  error_message?: string
  error_step?: string
}) {
  try {
    await supabaseAdmin.from('publicaciones_log').insert(data)
  } catch (err) {
    console.error('Error guardando log:', err)
  }
}