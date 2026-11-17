import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: process.env.INVITATION_E2E === '1' ? false : undefined,
  experimental: { proxyClientMaxBodySize: "20mb" },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
