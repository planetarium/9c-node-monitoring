import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_API_URL: process.env.NEXT_API_URL || "http://localhost:4000",
    NEXT_WEB_URL: process.env.NEXT_WEB_URL || "http://localhost:3000",
  },
};

export default nextConfig;
