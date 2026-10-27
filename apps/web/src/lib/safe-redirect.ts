const BASE = 'http://interno.invalid';

// Só caminhos deste site: "//outro.com" ou "/\outro.com" levariam o navegador para fora.
export function safeRedirect(target: string | string[] | undefined, fallback = '/') {
  if (typeof target !== 'string' || !target.startsWith('/')) return fallback;
  try {
    const url = new URL(target, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function withRedirect(path: string, target: string) {
  return target === '/' ? path : `${path}?next=${encodeURIComponent(target)}`;
}

export type AuthPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};
