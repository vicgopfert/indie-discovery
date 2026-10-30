import type { ComponentProps } from 'react';

// O <Form> do Next depende do roteador do App Router, que não existe nos testes; no HTML,
// ele é um formulário GET comum.
export default function Form(props: ComponentProps<'form'>) {
  return <form {...props} />;
}
