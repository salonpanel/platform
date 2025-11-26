import type { NextConfig } from "next";

const nextConfig = {
  env: {
    RESEND_API_KEY:
      process.env.RESEND_API_KEY ??
      "re_e6RujSDT_Csn6kmccpnsPdTgG7bdjkVSA",
  },
  // Optimizaciones de rendimiento
  compress: true, // Compresión gzip
  poweredByHeader: false, // Remover header X-Powered-By
  reactStrictMode: true, // Modo estricto de React
  
  // Optimización de imágenes
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  
  // Experimental: optimizaciones de Next.js 16
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react', '@supabase/supabase-js'],
  },
  
  // Forzar a Next/Turbopack a tomar este directorio como raíz del workspace
  turbopack: {
    root: __dirname,
  },
} satisfies NextConfig & {
  turbopack?: {
    root?: string;
  };
};

export default nextConfig;
