import { NextRequest, NextResponse } from 'next/server'
import { logPublicacion } from '@/lib/log'

// Endpoint (App Router de Next.js) que actúa como proxy entre el frontend
// y la API REST de WordPress para una nota puntual (GET, PUT, DELETE por :id).
// Todas las credenciales de WordPress viven en variables de entorno para no
// exponerlas nunca al cliente.
const WP_URL = process.env.WP_URL
const WP_USER = process.env.WP_USER
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD

// WordPress usa "Application Passwords": se autentica con Basic Auth
// codificando "usuario:app_password" en base64. Este header se reutiliza
// en las tres rutas (GET, PUT, DELETE) de este archivo.
const authHeader = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64')

// ── Obtener una nota completa para edición ────────────────────
// GET /api/posts/[id]
// Devuelve los datos "crudos" (raw) de una nota para poder precargarlos
// en el formulario de edición del frontend.
export async function GET(
  _req: NextRequest, // no se usa el request, solo el parámetro de la URL
  { params }: { params: { id: string } }
) {
  try {
    // context=edit le pide a WordPress los campos "raw" (title.raw,
    // content.raw, etc.) en vez de los ya renderizados en HTML.
    const res = await fetch(
      `${WP_URL}/wp-json/wp/v2/posts/${params.id}?context=edit`,
      { headers: { 'Authorization': authHeader }, cache: 'no-store' } // sin cache: siempre traer la versión más reciente
    )

    if (!res.ok) {
      // WordPress devuelve el detalle del error en JSON; se lo reenviamos
      // al cliente junto con el mismo status code que dio WP.
      const error = await res.json()
      return NextResponse.json({ error }, { status: res.status })
    }

    const post = await res.json()

    // Resolver nombres de tags (WordPress devuelve solo IDs)
    // El post trae post.tags como array de IDs numéricos; hay que pedir
    // aparte los nombres reales para mostrarlos en el formulario.
    let tagNames: string[] = []
    if (post.tags?.length > 0) {
      const tagsRes = await fetch(
        // include=1,2,3 filtra por esos IDs puntuales; per_page=100 asegura
        // traerlos todos en una sola llamada (evita paginación).
        `${WP_URL}/wp-json/wp/v2/tags?include=${post.tags.join(',')}&per_page=100`,
        { headers: { 'Authorization': authHeader } }
      )
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json()
        tagNames = tagsData.map((t: any) => t.name)
      }
      // Si tagsRes falla, se ignora silenciosamente y tagNames queda en [].
    }

    // Resolver URL de la imagen destacada
    // featured_media también es solo un ID; hay que pedir el objeto media
    // para obtener la URL pública de la imagen.
    let featuredMediaUrl: string | null = null
    if (post.featured_media) {
      const mediaRes = await fetch(
        // _fields=source_url le pide a WP que devuelva únicamente ese
        // campo, para no traer todo el objeto media de más.
        `${WP_URL}/wp-json/wp/v2/media/${post.featured_media}?_fields=source_url`,
        { headers: { 'Authorization': authHeader } }
      )
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json()
        featuredMediaUrl = mediaData.source_url ?? null
      }
      // Si mediaRes falla (p. ej. la imagen fue borrada), queda en null.
    }

    // Se devuelve un objeto "aplanado" y con nombres más cómodos para el
    // frontend, en vez de la estructura anidada que usa la API de WordPress.
    return NextResponse.json({
      id: post.id,
      title: post.title?.raw ?? '',
      excerpt: post.excerpt?.raw ?? '',
      content: post.content?.raw ?? '',
      categoryId: post.categories?.[0] ?? null, // solo se soporta una categoría principal
      tags: tagNames,
      featuredMediaId: post.featured_media ?? 0,
      featuredMediaUrl,
      link: post.link,
    })
  } catch {
    // Cualquier error no controlado (red caída, JSON inválido, etc.)
    // termina como un 500 genérico; no se loggea porque GET es solo lectura.
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── Actualizar una nota ───────────────────────────────────────
// PUT /api/posts/[id]
// Recibe los campos editados desde el frontend y los reenvía a WordPress.
// Además, registra en el log (tabla/archivo interno de la app) si la
// edición tuvo éxito o falló, para poder auditarlo luego desde el admin.
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Se declara fuera del try para que esté disponible también en el catch
  // (así el log de error puede incluir el título aunque falle el fetch).
  let title: string | undefined
  try {
    const body = await req.json()
    title = body.title
    const { excerpt, content, categoryId, tags, featuredMediaId } = body

    const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${params.id}`, {
      method: 'POST', // WordPress acepta POST para actualizar recursos existentes
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      // Se traducen los nombres "amigables" del frontend a los nombres
      // de campo que espera la API de WordPress (categories, featured_media).
      body: JSON.stringify({
        title,
        excerpt,
        content,
        categories: [categoryId], // WP espera un array aunque solo se maneje una categoría
        tags,
        featured_media: featuredMediaId ?? 0, // 0 = sin imagen destacada
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      // Se deja constancia del fallo en el log antes de responder al cliente.
      await logPublicacion({
        status: 'error',
        title,
        error_message: error?.message ?? 'Error al editar',
        error_step: 'editar',
      })
      return NextResponse.json({ error }, { status: res.status })
    }

    const post = await res.json()

    // Edición exitosa: se registra en el log con un prefijo distintivo
    // para diferenciarla de una publicación nueva en el historial del admin.
    await logPublicacion({
      status: 'success',
      title: `[Editada] ${title}`,
      wp_url: post.link,
    })

    return NextResponse.json({ url: post.link, id: post.id })
  } catch (err: any) {
    // Error inesperado (red, parseo, etc.): también se loggea, usando el
    // título capturado antes del fetch si es que llegó a asignarse.
    await logPublicacion({
      status: 'error',
      title,
      error_message: err.message ?? 'Error interno',
      error_step: 'editar',
    })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── Eliminar una nota (a la papelera de WordPress) ────────────
// DELETE /api/posts/[id]
// Por defecto, el endpoint DELETE de WordPress no borra permanentemente:
// mueve el post a la papelera (a menos que se pase ?force=true, que no
// se usa aquí). También deja constancia en el log de la app.
export async function DELETE(
  _req: NextRequest, // no se usa el body, solo el id de la URL
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${params.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': authHeader },
    })

    if (!res.ok) {
      const error = await res.json()
      // Nota: aquí no se tiene el título del post porque nunca se pidió
      // (a diferencia de PUT), por eso el log de error no incluye "title".
      await logPublicacion({
        status: 'error',
        error_message: error?.message ?? 'Error al eliminar',
        error_step: 'eliminar',
      })
      return NextResponse.json({ error }, { status: res.status })
    }

    // WordPress, al eliminar (mandar a papelera), devuelve el objeto del
    // post tal como quedó. Se usa para recuperar su título y loggearlo.
    const post = await res.json()
    // rendered: título en HTML (caso normal); raw: por si viniera en modo edición.
    const title = post.title?.rendered ?? post.title?.raw ?? ''

    await logPublicacion({
      status: 'success',
      title: `[Eliminada] ${title}`,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    await logPublicacion({
      status: 'error',
      error_message: err.message ?? 'Error interno',
      error_step: 'eliminar',
    })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
