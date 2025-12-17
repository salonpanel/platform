/**
 * Setup para tests Jest
 * Configuración inicial para ejecutar tests
 */

// Configurar variables de entorno para tests
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

// Configurar timeouts
jest.setTimeout(30000);

// Limpiar después de cada test
afterEach(() => {
  jest.clearAllMocks();
});
