import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, which the Dockerfile ships.
  output: 'standalone',
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
