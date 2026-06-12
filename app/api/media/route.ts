import { NextRequest, NextResponse } from 'next/server'
import { logPublicacion } from '@/lib/log'

const WP_URL = process.env.WP_URL
const WP_USER = process.env.WP_USER
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD

const authHeader = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64')

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const mediaRes = await fetch(`${WP_URL}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Disposition': `attachment; filename="${file.name}"`,
        'Content-Type': file.type,
      },
      body: buffer as any,
    })

    if (!mediaRes.ok) {
      const error = await mediaRes.json()
      await logPublicacion({
        status: 'error',
        error_message: error?.message ?? 'Error al subir imagen',
        error_step: 'media',
      })
      return NextResponse.json({ error }, { status: mediaRes.status })
    }

    const media = await mediaRes.json()
    return NextResponse.json({ 
      id: media.id, 
      url: media.source_url 
    })

  } catch (err: any) {
    await logPublicacion({
      status: 'error',
      error_message: err.message ?? 'Error al subir imagen',
      error_step: 'media',
    })
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
  }
}