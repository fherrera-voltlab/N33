// Valores por defecto para que las rutas que leen `process.env.X` a nivel de
// módulo tengan algo con qué inicializarse en cada test. Los tests que
// necesitan simular una variable faltante la borran puntualmente con
// `delete process.env.X` y usan `jest.resetModules()` antes de reimportar
// el archivo de ruta (ver README de tests o los propios *.test.ts).
process.env.WP_URL = 'https://cms.test.local'
process.env.WP_USER = 'test-user'
process.env.WP_APP_PASSWORD = 'test-app-password'
process.env.SUPABASE_URL = 'https://supabase.test.local'
process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
