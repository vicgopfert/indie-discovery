import type { NextConfig } from 'next';
import { apiUrl } from './src/config/api';

const nextConfig: NextConfig = {
  // Mesma origem para o navegador: o cookie de sessão fica first-party.
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]);
  },
  // As páginas de redefinição e de confirmação recebem o token no endereço: nenhum pedido que
  // elas fizerem leva o endereço como Referer.
  headers() {
    return Promise.resolve(
      ['/redefinir-senha', '/confirmar-email'].map((source) => ({
        source,
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      })),
    );
  },
};

export default nextConfig;
