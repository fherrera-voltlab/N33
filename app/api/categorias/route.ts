import { NextResponse } from 'next/server'

// Endpoint (App Router de Next.js) que actúa como proxy entre el frontend
// y la API REST de WordPress para listar las categorías disponibles, así
// el formulario de publicación puede mostrarlas en un selector.
const WP_URL = process.env.WP_URL

// ── Listar categorías disponibles ─────────────────────────────
// GET /api/categorias
// No requiere autenticación porque WordPress expone las categorías
// públicamente (son de solo lectura para el visitante final).
export async function GET() {
  try {
    // per_page=50 asegura traer todas las categorías del sitio en una sola
    // llamada. revalidate: 3600 cachea la respuesta por 1 hora, ya que las
    // categorías cambian muy poco y así se evita golpear WP en cada carga.
    const res = await fetch(`${WP_URL}/wp-json/wp/v2/categories?per_page=50`, {
      next: { revalidate: 3600 }
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Error al obtener categorías' }, { status: res.status })
    }

    const categories = await res.json()
    // Se descarta la categoría por defecto de WordPress ("Uncategorized"/
    // "Sin categoría", según el idioma del sitio) porque no es una opción
    // válida para el editor, y se devuelve solo id/name (sin el resto de
    // los campos que trae WP) para simplificar el consumo en el frontend.
    const filtered = categories
      .filter((c: any) => c.name !== 'Uncategorized' && c.name !== 'Sin categoría')
      .map((c: any) => ({ id: c.id, name: c.name }))

    return NextResponse.json(filtered)
  } catch (err) {
    // Error inesperado (red caída, JSON inválido, etc.): no se loggea en
    // Supabase porque este endpoint es solo de lectura y no forma parte
    // del flujo de publicación que se audita.
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}