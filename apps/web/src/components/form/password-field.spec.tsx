import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PasswordField } from './password-field';

const Schema = z.object({ password: z.string().min(8, 'Mínimo de 8 caracteres.') });

function PasswordForm({ onValid }: { onValid: (password: string) => void }) {
  const form = useForm({ resolver: zodResolver(Schema), defaultValues: { password: '' } });
  return (
    <form onSubmit={(event) => void form.handleSubmit(({ password }) => onValid(password))(event)}>
      <PasswordField
        control={form.control}
        name="password"
        label="Senha"
        autoComplete="current-password"
      />
      <button type="submit">Enviar</button>
    </form>
  );
}

function setup() {
  const onValid = vi.fn();
  render(<PasswordForm onValid={onValid} />);
  return {
    user: userEvent.setup(),
    onValid,
    field: screen.getByLabelText('Senha'),
    toggle: screen.getByRole('button', { name: 'Mostrar senha' }),
  };
}

describe('PasswordField', () => {
  it('começa com a senha oculta e o botão dentro do campo, ligado a ele', () => {
    const { field, toggle } = setup();

    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveAttribute('autocomplete', 'current-password');
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-controls', field.id);
    expect(toggle).toHaveAttribute('title', 'Mostrar senha');
  });

  it('alterna pelo clique, com o rótulo fixo e o autocomplete mantido', async () => {
    const { user, field, toggle } = setup();

    await user.click(toggle);
    expect(field).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAccessibleName('Mostrar senha');
    expect(field).toHaveAttribute('autocomplete', 'current-password');

    await user.click(toggle);
    expect(field).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('alterna pelo teclado, com Enter e Espaço, sem enviar o formulário', async () => {
    const { user, onValid, field, toggle } = setup();

    await user.type(field, 'senha-forte');
    await user.tab();
    expect(toggle).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(field).toHaveAttribute('type', 'text');
    await user.keyboard(' ');
    expect(field).toHaveAttribute('type', 'password');
    expect(onValid).not.toHaveBeenCalled();
  });

  it('desliga corretor, maiúscula automática e correção no campo', async () => {
    const { user, field, toggle } = setup();

    await user.click(toggle);

    expect(field).toHaveAttribute('spellcheck', 'false');
    expect(field).toHaveAttribute('autocapitalize', 'none');
    expect(field).toHaveAttribute('autocorrect', 'off');
  });

  it('volta a ocultar a senha no envio, com o erro ligado ao campo', async () => {
    const { user, field, toggle } = setup();

    await user.type(field, 'curta');
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Mínimo de 8 caracteres.')).toBeInTheDocument();
    expect(field).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(field).toHaveAccessibleDescription('Mínimo de 8 caracteres.');
  });

  it('envia a senha digitada com ela visível', async () => {
    const { user, onValid, field, toggle } = setup();

    await user.click(toggle);
    await user.type(field, 'senha-forte');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onValid).toHaveBeenCalledWith('senha-forte');
    expect(field).toHaveAttribute('type', 'password');
  });
});
