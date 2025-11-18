import type { NextConfig } from "next";

const nextConfig = {
  env: {
    RESEND_API_KEY:
      process.env.RESEND_API_KEY ??
      "re_e6RujSDT_Csn6kmccpnsPdTgG7bdjkVSA",
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
