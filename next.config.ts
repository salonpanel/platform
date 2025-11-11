import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    RESEND_API_KEY:
      process.env.RESEND_API_KEY ??
      "re_e6RujSDT_Csn6kmccpnsPdTgG7bdjkVSA",
  },
};

export default nextConfig;
