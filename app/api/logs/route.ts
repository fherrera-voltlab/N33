import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// ── Historial de publicaciones/ediciones/errores ──────────────
// GET /api/logs
// Devuelve las filas de la tabla "publicaciones_log" (llenada por
// logPublicacion en lib/log.ts cada vez que se publica, edita o elimina
// una nota) para que app/admin/page.tsx las muestre como historial/log
// de errores en el panel de administración.
export async function GET(req: NextRequest) {
  // Filtros opcionales que llegan como query params desde el admin
  // (ver el fetch a `/api/logs?...` en app/admin/page.tsx).
  const status = req.nextUrl.searchParams.get('status') // 'success' | 'error' | null
  const from = req.nextUrl.searchParams.get('from') // fecha desde
  const to = req.nextUrl.searchParams.get('to') // fecha hasta

  try {
    // Se arma la query de a poco (no se ejecuta hasta el await de más abajo),
    // siempre ordenada por fecha descendente para mostrar lo más reciente primero.
    let query = getSupabaseAdmin()
      .from('publicaciones_log')
      .select('*')
      .order('created_at', { ascending: false })

    // Cada filtro se agrega solo si vino en la URL; así el mismo endpoint
    // sirve tanto para traer todo el historial como para una búsqueda acotada.
    if (status) query = query.eq('status', status)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Se devuelve el array de logs tal cual viene de Supabase, sin transformar.
    return NextResponse.json(data)
  } catch (err: any) {
    // getSupabaseAdmin() puede tirar acá si faltan las variables de entorno
    // de Supabase; sin este catch, ese error quedaba sin manejar y rompía
    // la respuesta en vez de devolver un JSON de error prolijo.
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}