import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    RESEND_API_KEY:
      process.env.RESEND_API_KEY ??
      "re_e6RujSDT_Csn6kmccpnsPdTgG7bdjkVSA",
  },

  // 1️⃣ Ajustes de desarrollo recomendados
  reactStrictMode: false, // evita dobles renders innecesarios en dev

  // Optimizaciones de rendimiento generales
  compress: true, // Compresión gzip
  poweredByHeader: false, // Remover header X-Powered-By

  // 2️⃣ Reducción de trabajo de watcher/FS (Webpack fallback)
  webpack: (config) => {
    config.watchOptions = {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.turbo/**'
      ]
    };
    return config;
  },

  // 3️⃣ Configuración experimental y Turbopack
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react', '@supabase/supabase-js'],
  },

  // Configuración de imágenes y optimización
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jsqminbgggwhvkfgeibz.supabase.co',
      },
    ],
  },

  // Proxies y Headers (Migrados de next.config.js)
  async rewrites() {
    const SUPABASE_URL = 'https://jsqminbgggwhvkfgeibz.supabase.co';
    return [
      {
        source: '/rest-proxy/:path*',
        destination: `${SUPABASE_URL}/rest/v1/:path*`,
      },
      {
        source: '/storage-proxy/:path*',
        destination: `${SUPABASE_URL}/storage/v1/:path*`,
      },
    ];
  },

  async headers() {
    return [
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
};

export default nextConfig;
