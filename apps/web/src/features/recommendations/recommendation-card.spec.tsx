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

  it('sem motivo, mostra só o jogo', () => {
    render(<RecommendationCard recommendation={sampleRecommendation({ reason: null })} />);

    expect(screen.queryByText(/Recomendado por/)).not.toBeInTheDocument();
  });

  it('o selo "Pouco conhecido" aparece só quando o jogo foi marcado', () => {
    const { rerender } = render(<RecommendationCard recommendation={sampleRecommendation()} />);
    expect(screen.queryByText('Pouco conhecido')).not.toBeInTheDocument();

    rerender(<RecommendationCard recommendation={sampleRecommendation({ lowKnown: true })} />);
    expect(screen.getByText('Pouco conhecido')).toBeInTheDocument();
  });
});
