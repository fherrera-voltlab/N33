import { NextRequest, NextResponse } from 'next/server'
import { logPublicacion } from '@/lib/log'
import { getWpConfig } from '@/lib/wordpress'

// Endpoint (App Router de Next.js) que actúa como proxy entre el frontend
// y la API REST de WordPress para subir archivos de media (imágenes).
// Las credenciales de WordPress viven en variables de entorno para no
// exponerlas nunca al cliente.

// ── Subir una imagen a la librería de media de WordPress ─────
// POST /api/media
// Recibe un archivo desde el frontend (FormData) y lo sube a WordPress
// para poder usarlo luego como imagen destacada de una nota.
export async function POST(req: NextRequest) {
  const wp = getWpConfig()
  if (!wp) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  try {
    // El frontend envía la imagen como multipart/form-data (no JSON),
    // por eso se lee con formData() en vez de req.json().
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })
    }

    // La API de media de WordPress espera el binario crudo del archivo
    // en el body, no un FormData; por eso se convierte a ArrayBuffer y
    // luego a Buffer antes de reenviarlo.
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const mediaRes = await fetch(`${wp.url}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': wp.authHeader,
        // WordPress necesita el nombre de archivo en este header para
        // saber cómo nombrar/tipar el adjunto que se está subiendo.
        'Content-Disposition': `attachment; filename="${file.name}"`,
        // Se reenvía el mismo Content-Type del archivo original (ej. image/png).
        'Content-Type': file.type,
      },
      body: buffer as any,
    })

    if (!mediaRes.ok) {
      const error = await mediaRes.json()
      // Se deja constancia del fallo en el log antes de responder al cliente,
      // usando 'media' como paso para diferenciarlo de errores de publicar/editar.
      await logPublicacion({
        status: 'error',
        error_message: error?.message ?? 'Error al subir imagen',
        error_step: 'media',
      })
      return NextResponse.json({ error }, { status: mediaRes.status })
    }

    const media = await mediaRes.json()
    // Se devuelven solo id y url (no todo el objeto media de WP): el id
    // se usa como featured_media al publicar/editar, y la url para la
    // vista previa en el frontend.
    return NextResponse.json({
      id: media.id,
      url: media.source_url
    })

  } catch (err: any) {
    // Error inesperado (red, parseo, etc.): también se loggea antes de
    // responder con un 500 genérico al cliente.
    await logPublicacion({
      status: 'error',
      error_message: err.message ?? 'Error al subir imagen',
      error_step: 'media',
    })
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
  }
}