/** @type {import('next').NextConfig} */
//
// S10b notes:
// - transpilePackages: dropped 'ai-agent' and 'workflow-builder' — those
//   submodules were removed in S10a's prune. Only 'studio' remains.
// - rewrites: /v1/* and /admin/* are proxied to modelhub-backend (default
//   :6666) during local dev so axios `withCredentials: true` cookies stay
//   same-origin and avoid CORS preflight churn. Production deploys wire
//   the same paths through nginx (per S11-S13-OPS-DESIGN.md §S13 topology).
const BACKEND = process.env.MODELHUB_BACKEND_URL || 'http://localhost:6666';

const nextConfig = {
  transpilePackages: ['studio'],
  async rewrites() {
    return [
      { source: '/v1/:path*',    destination: `${BACKEND}/v1/:path*` },
      { source: '/admin/:path*', destination: `${BACKEND}/admin/:path*` },
    ];
  },
};

export default nextConfig;
