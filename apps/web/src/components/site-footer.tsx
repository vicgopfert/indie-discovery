export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground">
        Dados de jogos fornecidos pelo{' '}
        <a
          href="https://www.igdb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          IGDB.com
        </a>
        .
      </div>
    </footer>
  );
}
