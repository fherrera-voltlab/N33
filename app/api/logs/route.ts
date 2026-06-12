import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') // 'success' | 'error' | null
  const from = req.nextUrl.searchParams.get('from') // fecha desde
  const to = req.nextUrl.searchParams.get('to') // fecha hasta

  let query = supabaseAdmin
    .from('publicaciones_log')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}