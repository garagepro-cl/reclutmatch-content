import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "satori",
    "@resvg/resvg-js",
    "ffmpeg-static",
    "grammy",
    "googleapis",
    "node-cron",
    "@anthropic-ai/sdk",
  ],
};

export default nextConfig;
