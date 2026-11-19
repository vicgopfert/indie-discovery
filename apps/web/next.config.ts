import type { NextConfig } from 'next';
import { apiUrl } from './src/config/api';

const nextConfig: NextConfig = {
  // Mesma origem para o navegador: o cookie de sessão fica first-party.
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]);
  },
  // A página de redefinição recebe o token no endereço: nenhum pedido que ela fizer leva o
  // endereço como Referer.
  headers() {
    return Promise.resolve([
      {
        source: '/redefinir-senha',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ]);
  },
};

export default nextConfig;
