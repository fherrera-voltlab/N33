import { NextRequest, NextResponse } from 'next/server'

const WP_URL = process.env.WP_URL
const WP_USER = process.env.WP_USER
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD
const authHeader = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64')

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') ?? ''

  // Buscar si ya existe
  const search = await fetch(`${WP_URL}/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}`)
  const existing = await search.json()
  const found = existing.find((t: any) => t.name.toLowerCase() === name.toLowerCase())
  if (found) return NextResponse.json({ id: found.id })

  // Crear si no existe
  const create = await fetch(`${WP_URL}/wp-json/wp/v2/tags`, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const tag = await create.json()
  return NextResponse.json({ id: tag.id })
}