import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { sampleGame } from '@/test/catalog';
import { GameCard } from './game-card';

describe('GameCard', () => {
  it('mostra nome com link para a ficha, data e gêneros', () => {
    render(<GameCard game={sampleGame()} />);

    expect(screen.getByRole('link', { name: 'Celeste' })).toHaveAttribute('href', '/jogos/celeste');
    expect(screen.getByText('Lançado em 25 de jan. de 2018')).toBeInTheDocument();
    expect(screen.getByText('Aventura · Plataforma')).toBeInTheDocument();
    expect(screen.queryByText('Em breve')).not.toBeInTheDocument();
  });

  it('carrega a capa pequena direto da CDN da IGDB, sob demanda', () => {
    const { container } = render(<GameCard game={sampleGame()} />);

    const cover = container.querySelector('img');
    expect(cover).toHaveAttribute(
      'src',
      'https://images.igdb.com/igdb/image/upload/t_cover_small_2x/co3byy.jpg',
    );
    expect(cover).toHaveAttribute('loading', 'lazy');
  });

  it('jogo não lançado tem o selo "Em breve" e a data prevista', () => {
    render(
      <GameCard game={sampleGame({ releaseStatus: 'UPCOMING', firstReleaseDate: '2027-03-12' })} />,
    );

    expect(screen.getByText('Em breve')).toBeInTheDocument();
    expect(screen.getByText('Previsto para 12 de mar. de 2027')).toBeInTheDocument();
  });

  it('sem data, diz que não há data em vez de deixar vazio', () => {
    render(<GameCard game={sampleGame({ releaseStatus: 'UPCOMING', firstReleaseDate: null })} />);

    expect(screen.getByText('Sem data prevista')).toBeInTheDocument();
  });

  it('sem capa, mostra um quadro substituto com o nome', () => {
    const { container } = render(<GameCard game={sampleGame({ coverImageId: '' })} />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getAllByText('Celeste')).toHaveLength(2);
  });
});
