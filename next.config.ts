import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "remedies-chapel-administrator-complicated.trycloudflare.com",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
