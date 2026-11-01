import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: process.env.INVITATION_E2E === '1' ? false : undefined,
  /* config options here */
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
