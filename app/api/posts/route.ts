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

  // "page": página actual que pide el frontend (por defecto la primera).
  const page = req.nextUrl.searchParams.get('page') ?? '1'
  // "search": texto de búsqueda opcional que ingresa el usuario en el admin.
  const search = req.nextUrl.searchParams.get('search') ?? ''

  // Arma los query params para pedirle el listado a WordPress. `withEmbed`
  // controla si se pide la miniatura (ver comentario más abajo); se separa
  // en una función para poder reintentar sin ella si hace falta.
  const buildParams = (withEmbed: boolean) => {
    const params = new URLSearchParams({
      status: 'publish', // solo notas publicadas, no borradores ni papelera
      per_page: '10', // tamaño de página fijo, coherente con la paginación del admin
      page,
      orderby: 'date',
      order: 'desc', // las más recientes primero
      // Se pide a WordPress solo los campos que necesita el listado, para
      // no traer de más (contenido completo, etc.).
      _fields: withEmbed ? 'id,title,date,link,featured_media,_embedded' : 'id,title,date,link',
    })
    if (withEmbed) {
      // _embed incluye el objeto de la imagen destacada (con sus distintos
      // tamaños) en la misma respuesta, para no tener que pedirlo aparte
      // por cada post como hace GET /api/posts/[id].
      params.set('_embed', 'wp:featuredmedia')
    }
    // Solo se agrega "search" si el usuario efectivamente escribió algo;
    // si no, se omite en vez de mandar un string vacío a WordPress.
    if (search) params.set('search', search)
    return params
  }

  // Pide el listado a WordPress; devuelve ok:false (en vez de tirar una
  // excepción) tanto si WP respondió con error como si el body no se pudo
  // interpretar como el array de posts esperado (JSON inválido, forma
  // inesperada, etc.), para que el llamador pueda reintentar sin _embed.
  const fetchPosts = async (withEmbed: boolean) => {
    const res = await fetch(`${wp.url}/wp-json/wp/v2/posts?${buildParams(withEmbed)}`, {
      headers: { 'Authorization': wp.authHeader },
      cache: 'no-store', // sin cache: siempre traer el listado más actualizado
    })
    if (!res.ok) return { ok: false as const, status: res.status }

    try {
      const body = await res.json()
      if (!Array.isArray(body)) return { ok: false as const, status: 500 }
      return { ok: true as const, posts: body, totalPages: Number(res.headers.get('X-WP-TotalPages') ?? '1') }
    } catch {
      // res.ok era true pero el body no es JSON válido (ej. un warning de
      // PHP mezclado con la respuesta por culpa de _embed).
      return { ok: false as const, status: 500 }
    }
  }

  try {
    let result = await fetchPosts(true)

    // Si pedir la miniatura (_embed) hace que la respuesta de WordPress no
    // sea el JSON limpio esperado (un plugin, una imagen rota, etc.), se
    // reintenta sin ella: es mejor mostrar el listado sin miniaturas que
    // no mostrarlo directamente.
    if (!result.ok) {
      console.error('GET /api/posts: la respuesta con _embed no fue válida, reintentando sin miniatura')
      result = await fetchPosts(false)
    }

    if (!result.ok) {
      return NextResponse.json({ error: 'Error al obtener notas' }, { status: result.status })
    }

    return NextResponse.json({
      // Se devuelve un listado "aplanado" con solo lo que necesita la tabla
      // del admin, en vez de la estructura completa de WordPress.
      posts: result.posts.map((p: any) => {
        // La imagen destacada (si existe) viene embebida en _embedded gracias
        // a _embed=wp:featuredmedia; se prioriza el tamaño "thumbnail" (más
        // liviano para la miniatura de la lista) y se cae al original si WP
        // no generó ese tamaño. Si se usó el fallback sin _embed, _embedded
        // directamente no existe y thumbnail queda en null.
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
      totalPages: result.totalPages,
    })
  } catch (err) {
    // Cualquier error no controlado (red caída, JSON inválido, etc.)
    // termina como un 500 genérico, pero se deja rastro en los logs del
    // servidor para poder diagnosticarlo (antes se perdía sin dejar rastro).
    console.error('GET /api/posts:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
