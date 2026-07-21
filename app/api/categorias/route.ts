import { NextResponse } from 'next/server'
import { getWpUrl } from '@/lib/wordpress'

// Endpoint (App Router de Next.js) que actúa como proxy entre el frontend
// y la API REST de WordPress para listar las categorías disponibles, así
// el formulario de publicación puede mostrarlas en un selector.

// Máximo permitido por página en la REST API de WordPress.
const PER_PAGE = 100

// ── Listar categorías disponibles ─────────────────────────────
// GET /api/categorias
// No requiere autenticación porque WordPress expone las categorías
// públicamente (son de solo lectura para el visitante final).
export async function GET() {
  const wpUrl = getWpUrl()
  if (!wpUrl) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  try {
    // Se recorren todas las páginas que reporte WordPress (X-WP-TotalPages)
    // en vez de asumir que un único per_page alcanza para todas las
    // categorías del sitio.
    let categories: any[] = []
    let page = 1
    let totalPages = 1

    do {
      const res = await fetch(
        `${wpUrl}/wp-json/wp/v2/categories?per_page=${PER_PAGE}&page=${page}`,
        { next: { revalidate: 3600 } } // cachea 1 hora: las categorías cambian muy poco
      )

      if (!res.ok) {
        return NextResponse.json({ error: 'Error al obtener categorías' }, { status: res.status })
      }

      categories = categories.concat(await res.json())
      totalPages = Number(res.headers.get('X-WP-TotalPages') ?? 1)
      page++
    } while (page <= totalPages)

    // Se descarta la categoría por defecto de WordPress por id/slug (1 /
    // "uncategorized", que WP nunca traduce ni cambia) en vez de por su
    // nombre visible, ya que ese nombre varía según el idioma del sitio o
    // si alguien lo renombró. Se devuelve solo id/name (sin el resto de
    // los campos que trae WP) para simplificar el consumo en el frontend.
    const filtered = categories
      .filter((c: any) => c.id !== 1 && c.slug !== 'uncategorized')
      .map((c: any) => ({ id: c.id, name: c.name }))

    return NextResponse.json(filtered)
  } catch (err) {
    // Error inesperado (red caída, JSON inválido, etc.): no se loggea en
    // Supabase porque este endpoint es solo de lectura y no forma parte
    // del flujo de publicación que se audita.
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}