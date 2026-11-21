'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const subscribeToNothing = () => () => {};

// O token dos links enviados por e-mail só existe no navegador, depois do #, que não vai ao
// servidor: quem o lê só renderiza no navegador.
export function useInBrowser() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

const readToken = () => window.location.hash.slice(1) || null;

const removeTokenFromAddress = () => {
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
};

// Guardado no estado, o token sai da barra de endereço e do histórico. O link colado na mesma
// aba só muda o #, sem recarregar a página.
export function useTokenFromLink() {
  const [token, setToken] = useState(readToken);
  useEffect(() => {
    removeTokenFromAddress();
    const takeNewToken = () => {
      const next = readToken();
      if (next) setToken(next);
      removeTokenFromAddress();
    };
    window.addEventListener('hashchange', takeNewToken);
    return () => window.removeEventListener('hashchange', takeNewToken);
  }, []);
  return token;
}
