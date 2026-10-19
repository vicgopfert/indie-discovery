'use client';

import { ApiErrorSchema } from '@indie/contracts';
import { useEffect, useState } from 'react';

export function ApiStatus() {
  const [status, setStatus] = useState('verificando...');

  useEffect(() => {
    fetch('/api/health')
      .then(async (res) => {
        const body: unknown = await res.json();
        if (res.ok) return setStatus('API no ar');
        const error = ApiErrorSchema.safeParse(body);
        setStatus(error.success ? `erro: ${error.data.message}` : `erro ${res.status}`);
      })
      .catch(() => setStatus('API fora do ar'));
  }, []);

  return <p role="status">Status da API: {status}</p>;
}
