import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, which the Dockerfile ships.
  output: 'standalone',
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ['@electric-sql/pglite'],
  // Sections that moved: Work became Home and Agents; the rest live under Organization.
  async redirects() {
    return [
      { source: '/work', has: [{ type: 'query', key: 'tab', value: 'status' }], destination: '/agents', permanent: true },
      { source: '/work', destination: '/', permanent: true },
      { source: '/votes', destination: '/org?tab=governance', permanent: true },
      { source: '/funding', destination: '/org?tab=funding', permanent: true },
      { source: '/calendar', destination: '/org?tab=calendar', permanent: true },
      { source: '/docs', destination: '/org?tab=docs', permanent: true },
      { source: '/profile', destination: '/org?tab=people', permanent: true },
    ];
  },
};

export default nextConfig;
