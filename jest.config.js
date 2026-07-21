const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

// Entorno "node" (no jsdom): las rutas de app/api/* y lib/* son código de
// servidor puro (fetch + Supabase), no componentes de React.
const customJestConfig = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  // Los tests reales de conexión (scripts/check-connections.mjs) no son
  // Jest: se ejecutan aparte con `npm run check:conexiones`.
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
}

module.exports = createJestConfig(customJestConfig)
