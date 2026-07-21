#!/usr/bin/env node
// Chequeo de conexión REAL contra WordPress y Supabase, usando las
// credenciales configuradas en el entorno (ver package.json → "check:conexiones",
// que carga .env.local/.env con --env-file-if-exists antes de correr esto).
//
// A diferencia de las pruebas unitarias (npm test, que mockean fetch/Supabase
// y no necesitan credenciales reales), este script hace llamadas de red de
// verdad. Es de solo lectura: no crea, edita ni borra nada en WordPress ni
// en Supabase. Pensado para correr a mano antes de deployar o al diagnosticar
// un problema de configuración.
//
// Uso: npm run check:conexiones

import { createClient } from '@supabase/supabase-js'

const TIMEOUT_MS = 10_000

function withTimeout(promise, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, promise, cleanup: () => clearTimeout(timer) }
}

async function checkWordPress() {
  const url = process.env.WP_URL
  const user = process.env.WP_USER
  const appPassword = process.env.WP_APP_PASSWORD

  if (!url || !user || !appPassword) {
    const faltantes = [
      !url && 'WP_URL',
      !user && 'WP_USER',
      !appPassword && 'WP_APP_PASSWORD',
    ].filter(Boolean).join(', ')
    return { ok: false, message: `Faltan variables de entorno: ${faltantes}` }
  }

  const authHeader = 'Basic ' + Buffer.from(`${user}:${appPassword}`).toString('base64')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    // /users/me es de solo lectura y requiere auth válida: confirma a la vez
    // que WP_URL apunta a un WordPress real y que las credenciales funcionan.
    const res = await fetch(`${url}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: authHeader },
      signal: controller.signal,
    })

    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: `WordPress respondió ${res.status}: revisá WP_USER/WP_APP_PASSWORD` }
    }
    if (res.status === 404) {
      return { ok: false, message: 'WordPress respondió 404: revisá que WP_URL sea correcta y tenga la REST API habilitada' }
    }
    if (!res.ok) {
      return { ok: false, message: `WordPress respondió ${res.status}` }
    }

    const me = await res.json()
    return { ok: true, message: `conectado como "${me.name ?? me.slug ?? user}" (${url})` }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, message: `Sin respuesta de ${url} en ${TIMEOUT_MS / 1000}s (timeout)` }
    }
    return { ok: false, message: `No se pudo conectar a ${url}: ${err.message}` }
  } finally {
    clearTimeout(timer)
  }
}

async function checkSupabase() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!url || !serviceKey) {
    const faltantes = [!url && 'SUPABASE_URL', !serviceKey && 'SUPABASE_SERVICE_KEY']
      .filter(Boolean).join(', ')
    return { ok: false, message: `Faltan variables de entorno: ${faltantes}` }
  }

  try {
    const supabase = createClient(url, serviceKey)
    // Lectura mínima (1 fila) a la tabla que usa lib/log.ts, solo para
    // confirmar que la URL/clave son válidas y la tabla existe.
    const { error } = await supabase
      .from('publicaciones_log')
      .select('id')
      .limit(1)

    if (error) {
      return { ok: false, message: `Supabase respondió con error: ${error.message}` }
    }
    return { ok: true, message: `conectado (${url})` }
  } catch (err) {
    return { ok: false, message: `No se pudo conectar a Supabase: ${err.message}` }
  }
}

async function main() {
  console.log('Validando conexiones configuradas...\n')

  const [wp, supabase] = await Promise.all([checkWordPress(), checkSupabase()])

  const rows = [
    ['WordPress', wp],
    ['Supabase', supabase],
  ]

  for (const [name, result] of rows) {
    const icon = result.ok ? '✅' : '❌'
    console.log(`${icon} ${name}: ${result.message}`)
  }

  const allOk = rows.every(([, result]) => result.ok)
  console.log()
  console.log(allOk ? 'Todas las conexiones funcionan.' : 'Alguna conexión falló — revisá las variables de entorno arriba.')

  process.exit(allOk ? 0 : 1)
}

main()
