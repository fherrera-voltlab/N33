import { NextRequest, NextResponse } from 'next/server'
import { getWpConfig } from '@/lib/wordpress'

// Endpoint (App Router de Next.js) que actúa como proxy entre el frontend
// y la API REST de WordPress para el listado de notas (índice, sin :id).
// Todas las credenciales de WordPress viven en variables de entorno para no
// exponerlas nunca al cliente.

// ── Listar notas publicadas (con paginación y búsqueda) ───────
// GET /api/posts?page=&search=
// Usado por NotasPanel en app/admin/page.tsx para mostrar el listado de
// notas con paginación y filtro de texto, y desde ahí poder editarlas o
// eliminarlas (ver app/api/posts/[id]/route.ts).
export async function GET(req: NextRequest) {
  const wp = getWpConfig()
  if (!wp) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  try {
    // "page": página actual que pide el frontend (por defecto la primera).
    const page = req.nextUrl.searchParams.get('page') ?? '1'
    // "search": texto de búsqueda opcional que ingresa el usuario en el admin.
    const search = req.nextUrl.searchParams.get('search') ?? ''

    const params = new URLSearchParams({
      status: 'publish', // solo notas publicadas, no borradores ni papelera
      per_page: '10', // tamaño de página fijo, coherente con la paginación del admin
      page,
      orderby: 'date',
      order: 'desc', // las más recientes primero
      // Se pide a WordPress solo los campos que necesita el listado (más
      // featured_media y _embedded, para la miniatura) para no traer de más
      // (contenido completo, etc.).
      _fields: 'id,title,date,link,featured_media,_embedded',
      // _embed incluye el objeto de la imagen destacada (con sus distintos
      // tamaños) en la misma respuesta, para no tener que pedirlo aparte
      // por cada post como hace GET /api/posts/[id].
      _embed: 'wp:featuredmedia',
    })
    // Solo se agrega "search" si el usuario efectivamente escribió algo;
    // si no, se omite en vez de mandar un string vacío a WordPress.
    if (search) params.set('search', search)

    const res = await fetch(`${wp.url}/wp-json/wp/v2/posts?${params}`, {
      headers: { 'Authorization': wp.authHeader },
      cache: 'no-store', // sin cache: siempre traer el listado más actualizado
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Error al obtener notas' }, { status: res.status })
    }

    const posts = await res.json()
    // WordPress informa el total de páginas disponibles en este header
    // (no viene en el body), necesario para pintar la paginación en el admin.
    const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? '1')

    return NextResponse.json({
      // Se devuelve un listado "aplanado" con solo lo que necesita la tabla
      // del admin, en vez de la estructura completa de WordPress.
      posts: posts.map((p: any) => {
        // La imagen destacada (si existe) viene embebida en _embedded gracias
        // a _embed=wp:featuredmedia; se prioriza el tamaño "thumbnail" (más
        // liviano para la miniatura de la lista) y se cae al original si WP
        // no generó ese tamaño.
        const media = p._embedded?.['wp:featuredmedia']?.[0]
        const thumbnail = media?.media_details?.sizes?.thumbnail?.source_url
          ?? media?.source_url
          ?? null

        return {
          id: p.id,
          title: p.title?.rendered ?? '',
          date: p.date,
          link: p.link,
          thumbnail,
        }
      }),
      totalPages,
    })
  } catch {
    // Cualquier error no controlado (red caída, JSON inválido, etc.)
    // termina como un 500 genérico; no se loggea porque GET es solo lectura.
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
