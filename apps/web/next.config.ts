import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  // O navegador sempre chama /api/* no domínio do frontend; o Next repassa para
  // a API. Assim o cookie de sessão é first-party (seção 5).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
