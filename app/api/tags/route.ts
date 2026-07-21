import { NextRequest, NextResponse } from 'next/server'

// Endpoint (App Router de Next.js) que actúa como proxy hacia la API REST
// de WordPress para resolver tags por nombre: al publicar una nota, el
// frontend envía nombres de tags "en texto" pero WordPress solo acepta IDs
// numéricos en post.tags, así que este endpoint traduce nombre -> id,
// creando el tag en WP si todavía no existe.
const WP_URL = process.env.WP_URL
const WP_USER = process.env.WP_USER
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD

// Basic Auth con "Application Password" de WordPress, en base64. Solo se
// necesita para crear el tag (POST); la búsqueda (GET) es pública en WP.
const authHeader = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64')

// ── Resolver (o crear) un tag por nombre ──────────────────────
// GET /api/tags?name=...
// Busca un tag existente que coincida exactamente con el nombre recibido;
// si no lo encuentra, crea uno nuevo en WordPress. Siempre devuelve el id
// del tag, que es lo que necesita el post al publicarse/editarse.
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') ?? ''

  // Buscar si ya existe
  // El parámetro "search" de WP hace una búsqueda parcial/difusa, por eso
  // igual hace falta filtrar acá por coincidencia exacta (sin importar
  // mayúsculas/minúsculas) para no matchear tags que solo son similares.
  const search = await fetch(`${WP_URL}/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}`)
  const existing = await search.json()
  const found = existing.find((t: any) => t.name.toLowerCase() === name.toLowerCase())
  if (found) return NextResponse.json({ id: found.id })

  // Crear si no existe
  // Solo esta llamada requiere autenticación, porque crear contenido en WP
  // sí exige permisos (a diferencia de la búsqueda anterior, que es de lectura).
  const create = await fetch(`${WP_URL}/wp-json/wp/v2/tags`, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const tag = await create.json()
  return NextResponse.json({ id: tag.id })
}