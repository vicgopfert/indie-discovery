import { accountTracker } from './auth-throttle';

describe('accountTracker', () => {
  it('usa o e-mail normalizado como no LoginSchema', () => {
    expect(accountTracker({ body: { email: ' Jogadora@Example.com ' } })).toBe(
      'jogadora@example.com',
    );
  });

  it('nas rotas com sessão, usa a conta da sessão, não o corpo', () => {
    expect(
      accountTracker({ user: { id: 'id-da-jogadora' }, body: { email: 'outra@example.com' } }),
    ).toBe('user:id-da-jogadora');
  });

  it.each([
    ['sem corpo', {}],
    ['sem e-mail', { body: {} }],
    ['com e-mail que não é texto', { body: { email: ['a@example.com'] } }],
  ])('devolve uma chave vazia %s', (_, request) => {
    expect(accountTracker(request)).toBe('');
  });
});
