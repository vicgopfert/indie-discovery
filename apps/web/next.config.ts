import type { NextConfig } from 'next';
import { apiUrl } from './src/config/api';

const nextConfig: NextConfig = {
  // Mesma origem para o navegador: o cookie de sessão fica first-party.
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]);
  },
};

export default nextConfig;
