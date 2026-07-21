import { NextRequest, NextResponse } from 'next/server'

// Endpoint (App Router de Next.js) que actúa como proxy entre el frontend
// y la API REST de WordPress para el listado de notas (índice, sin :id).
// Todas las credenciales de WordPress viven en variables de entorno para no
// exponerlas nunca al cliente.
const WP_URL = process.env.WP_URL
const WP_USER = process.env.WP_USER
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD

// WordPress usa "Application Passwords": se autentica con Basic Auth
// codificando "usuario:app_password" en base64.
const authHeader = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64')

// ── Listar notas publicadas (con paginación y búsqueda) ───────
// GET /api/posts?page=&search=
// Usado por NotasPanel en app/admin/page.tsx para mostrar el listado de
// notas con paginación y filtro de texto, y desde ahí poder editarlas o
// eliminarlas (ver app/api/posts/[id]/route.ts).
export async function GET(req: NextRequest) {
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
      // Se pide a WordPress solo los campos que necesita el listado del admin,
      // para no traer de más (contenido completo, etc.).
      _fields: 'id,title,date,link',
    })
    // Solo se agrega "search" si el usuario efectivamente escribió algo;
    // si no, se omite en vez de mandar un string vacío a WordPress.
    if (search) params.set('search', search)

    const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts?${params}`, {
      headers: { 'Authorization': authHeader },
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
      posts: posts.map((p: any) => ({
        id: p.id,
        title: p.title?.rendered ?? '',
        date: p.date,
        link: p.link,
      })),
      totalPages,
    })
  } catch {
    // Cualquier error no controlado (red caída, JSON inválido, etc.)
    // termina como un 500 genérico; no se loggea porque GET es solo lectura.
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
