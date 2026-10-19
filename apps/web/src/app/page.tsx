import { ApiStatus } from './api-status';

// Página provisória do B-02: comprova a chamada à API pela mesma origem.
// O catálogo ocupa esta rota no B-23.
export default function HomePage() {
  return (
    <main>
      <h1>Indie Discovery</h1>
      <ApiStatus />
    </main>
  );
}
