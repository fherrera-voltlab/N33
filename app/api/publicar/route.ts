import { NextRequest, NextResponse } from 'next/server'
import { logPublicacion } from '@/lib/log'

// Endpoint (App Router de Next.js) que actúa como proxy entre el frontend
// y la API REST de WordPress para crear una nota nueva. A diferencia de
// app/api/posts/[id]/route.ts (que lee/edita/elimina una nota existente por
// :id), este archivo solo expone POST y siempre crea un post desde cero.
const WP_URL = process.env.WP_URL
const WP_USER = process.env.WP_USER
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD

// Mismo esquema de Basic Auth con Application Password que en posts/[id]:
// se codifica "usuario:app_password" en base64 para autenticar contra WP.
const authHeader = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64')

// ── Crear una nota nueva ───────────────────────────────────────
// POST /api/publicar
// Recibe los campos del formulario y crea el post directamente como
// 'publish' (a diferencia de PUT en posts/[id], que actualiza uno ya
// existente). Los IDs de categoría/tags/media ya vienen resueltos desde
// el frontend, por lo que aquí no hace falta resolver nombres ni URLs
// como sí hace el GET de posts/[id].
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, excerpt, content, categoryId, tags, featuredMediaId } = body

    // Sin :id en la URL: WP crea un recurso nuevo en la colección de posts.
    // status: 'publish' hace que la nota quede visible de inmediato (no se
    // guarda como borrador).
    const postRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        excerpt,
        content,
        status: 'publish',
        categories: [categoryId], // WP espera un array aunque solo se maneje una categoría
        tags,
        featured_media: featuredMediaId ?? 0, // 0 = sin imagen destacada
      }),
    })

    if (!postRes.ok) {
      const error = await postRes.json()
      // Se deja constancia del fallo en el log antes de responder al cliente,
      // para poder auditarlo luego desde el panel de admin.
      await logPublicacion({
        status: 'error',
        title,
        error_message: error?.message ?? 'Error al publicar',
        error_step: 'publicar',
      })
      return NextResponse.json({ error }, { status: postRes.status })
    }

    const post = await postRes.json()

    // Publicación exitosa: se registra en el log junto con la URL final
    // de la nota en WordPress (post.link).
    await logPublicacion({
      status: 'success',
      title,
      wp_url: post.link,
    })

    return NextResponse.json({ url: post.link, id: post.id })

  } catch (err: any) {
    // Error inesperado (red, JSON inválido, etc.): también se loggea,
    // aunque acá no se garantiza tener "title" si el req.json() falló antes.
    await logPublicacion({
      status: 'error',
      error_message: err.message ?? 'Error interno',
      error_step: 'publicar',
    })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}