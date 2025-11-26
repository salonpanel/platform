/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para resolver CORS en producción
  async rewrites() {
    const SUPABASE_URL = 'https://jsqminbgggwhvkfgeibz.supabase.co';
    
    return [
      // Proxy para todas las peticiones de Auth de Supabase
      {
        source: '/auth-proxy/:path*',
        destination: `${SUPABASE_URL}/auth/v1/:path*`,
      },
      // Proxy para peticiones REST de Supabase
      {
        source: '/rest-proxy/:path*',
        destination: `${SUPABASE_URL}/rest/v1/:path*`,
      },
      // Proxy para Storage de Supabase
      {
        source: '/storage-proxy/:path*',
        destination: `${SUPABASE_URL}/storage/v1/:path*`,
      },
    ];
  },

  // Configuración de headers CORS para los proxies
  async headers() {
    return [
      {
        source: '/auth-proxy/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization,apikey' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
      {
        source: '/rest-proxy/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization,apikey' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
      {
        source: '/storage-proxy/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization,apikey' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ];
  },

  // Configuración de imágenes y optimización
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jsqminbgggwhvkfgeibz.supabase.co',
      },
    ],
  },

  // Configuración de compilación
  poweredByHeader: false,

  // Forzar raíz de Turbopack para evitar advertencia de lockfiles fuera
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
