// Validación centralizada de la conexión hacia WordPress: evita que cada
// ruta de app/api/* repita el mismo chequeo de variables de entorno y, si
// falta alguna, deja rastro en los logs del servidor en vez de dejar que
// el fetch falle más adelante con un error confuso ("undefined/wp-json/...").
// Se leen las variables en cada llamada (no en el top del módulo) para que
// el chequeo sea siempre sobre el valor real y vigente de process.env.

// Usado por endpoints de solo lectura pública (ej. /api/categorias) que no
// necesitan autenticarse contra WordPress.
export function getWpUrl(): string | null {
  const url = process.env.WP_URL
  if (!url) {
    console.error('Falta configurar WP_URL')
    return null
  }
  return url
}

// Usado por endpoints que sí necesitan autenticarse (crear/editar/eliminar,
// o resolver tags). Devuelve la URL base y el header de Basic Auth ya
// armado con el "Application Password" de WordPress.
export function getWpConfig(): { url: string; authHeader: string } | null {
  const url = process.env.WP_URL
  const user = process.env.WP_USER
  const appPassword = process.env.WP_APP_PASSWORD

  if (!url || !user || !appPassword) {
    console.error('Faltan variables de entorno de WordPress (WP_URL/WP_USER/WP_APP_PASSWORD)')
    return null
  }

  return {
    url,
    authHeader: 'Basic ' + Buffer.from(`${user}:${appPassword}`).toString('base64'),
  }
}
