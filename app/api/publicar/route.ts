import { NextRequest, NextResponse } from 'next/server'

const WP_URL = process.env.WP_URL
const WP_USER = process.env.WP_USER
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD

const authHeader = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, excerpt, content, categoryId, tags, featuredMediaId } = body

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
        categories: [categoryId],
        tags,
        featured_media: featuredMediaId ?? 0,
      }),
    })

    if (!postRes.ok) {
      const error = await postRes.json()
      return NextResponse.json({ error }, { status: postRes.status })
    }

    const post = await postRes.json()
    return NextResponse.json({ url: post.link, id: post.id })

  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}