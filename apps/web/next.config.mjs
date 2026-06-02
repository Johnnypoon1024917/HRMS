/** @type {import('next').NextConfig} */
const nextConfig = {
  // Run via `next start` from the runtime image — simpler/more robust than
  // the standalone output for npm-workspaces monorepos.
  transpilePackages: ['@hrms/contracts'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
