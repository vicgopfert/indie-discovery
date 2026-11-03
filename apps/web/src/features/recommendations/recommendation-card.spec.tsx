import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { sampleRecommendation } from '@/test/recommendations';
import { RecommendationCard } from './recommendation-card';

describe('RecommendationCard', () => {
  it('mostra o jogo e os gêneros e temas do motivo, em texto', () => {
    render(<RecommendationCard recommendation={sampleRecommendation()} />);

    expect(screen.getByRole('link', { name: 'Celeste' })).toHaveAttribute('href', '/jogos/celeste');
    expect(screen.getByText('Recomendado por: Plataforma, Fantasia')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('o jogo que o jogador gostou tem link para a ficha', () => {
    render(
      <RecommendationCard
        recommendation={sampleRecommendation({
          reason: {
            kind: 'liked-game',
            game: { slug: 'hollow-knight', name: 'Hollow Knight', inCatalog: true },
          },
        })}
      />,
    );

    expect(screen.getByText(/Porque você gostou de/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hollow Knight' })).toHaveAttribute(
      'href',
      '/jogos/hollow-knight',
    );
  });

  it('o jogo que saiu do catálogo aparece sem link', () => {
    render(
      <RecommendationCard
        recommendation={sampleRecommendation({
          reason: {
            kind: 'liked-game',
            game: { slug: 'hollow-knight', name: 'Hollow Knight', inCatalog: false },
          },
        })}
      />,
    );

    expect(screen.getByText('Porque você gostou de Hollow Knight')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hollow Knight' })).not.toBeInTheDocument();
  });

  it('sem motivo, mostra só o jogo', () => {
    render(<RecommendationCard recommendation={sampleRecommendation({ reason: null })} />);

    expect(screen.queryByText(/Recomendado por|Porque você gostou/)).not.toBeInTheDocument();
  });

  it('o selo "Pouco conhecido" aparece só quando o jogo foi marcado', () => {
    const { rerender } = render(<RecommendationCard recommendation={sampleRecommendation()} />);
    expect(screen.queryByText('Pouco conhecido')).not.toBeInTheDocument();

    rerender(<RecommendationCard recommendation={sampleRecommendation({ lowKnown: true })} />);
    expect(screen.getByText('Pouco conhecido')).toBeInTheDocument();
  });
});
