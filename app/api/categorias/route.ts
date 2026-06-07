import { NextResponse } from 'next/server'

const WP_URL = process.env.WP_URL

export async function GET() {
  try {
    const res = await fetch(`${WP_URL}/wp-json/wp/v2/categories?per_page=50`, {
      next: { revalidate: 3600 }
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Error al obtener categorías' }, { status: res.status })
    }

    const categories = await res.json()
    const filtered = categories
      .filter((c: any) => c.name !== 'Uncategorized' && c.name !== 'Sin categoría')
      .map((c: any) => ({ id: c.id, name: c.name }))

    return NextResponse.json(filtered)
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}