# Documentação do projeto

| Documento | O que é |
| --- | --- |
| `proposta-conceitual.md` | Versão conceitual da proposta — problema, pesquisas de campo, justificativa e proposta de valor |
| `proposta-tecnica.md` | Plano técnico e de execução. Referência oficial durante a implementação |
| `vetorizacao-tfidf.md` | Vetorização TF-IDF (B-12): descarte, normalização por bloco, medição das configurações, empates, cobertura de etiquetas e jogos da BGS |
| `criterio-indie-casos.md` | Critério indie (B-11, B-59 e B-60): a regra de controle do estúdio, o teste de entrada das grandes empresas, os casos reais conferidos, as medições dos falsos negativos e da regra de controle, as limítrofes recusadas, o levantamento dos estúdios controlados, as exceções e as limitações |
| `recomendacao.md` | Recomendação: o núcleo de pontuação (B-32), com perfil, pontuação, desempate, motivos, "pouco conhecido", lista de populares e as medições de tempo e de empates; a rota `GET /api/recommendations` (B-33), com a partida a frio, o jogo fora do catálogo e o tempo de resposta; a página (B-35); as listas por interesse (B-71); os estilos (B-74); a revisão do módulo (B-76); a visão geral e o "ver mais" (B-72); as recomendações específicas (B-79), com as medições em produção; e os testes de ponta a ponta (B-36) |
| `estilos.md` | Estilos (B-73): medição de uma camada curada sobre as palavras-chave da IGDB e os termos do resumo, com o rascunho da taxonomia, a cobertura, a precisão e a estimativa de implementação; substituídos pelas etiquetas da Steam no B-78 |
| `etiquetas.md` | Etiquetas da comunidade Steam (B-77 a B-79): a medição da cobertura e da precisão, o vocabulário, as etiquetas no vetor, a regra de prateleiras de duas fases, os riscos, a ingestão e a interface (B-78), a regra na plataforma e os nomes da comunidade (B-79) |
| `ingestao.md` | Ingestão do catálogo (B-13): como rodar, o fluxo de uma execução, a política de falhas, as etiquetas da Steam (B-78), a carência pós-lançamento, o país do estúdio (B-56), os alertas de revisão, as coleções (B-57), a popularidade reconstruída, o "Want to Play" como sinal de interesse (B-69) e as medições das cargas locais e em produção |
| `colecoes.md` | Coleções culturais (B-57 e B-58): o fluxo da curadoria, a regra de curadoria e de ambientação, as coleções iniciais, as fontes da sugestão e as limitações, a API e a interface, com as conferências local e em produção |
| `precos.md` | Preços e demos da Steam (B-86 a B-88, B-90 e B-91): as decisões, a arquitetura da coleta em lote, a análise de viabilidade da GG.deals, as alternativas, os riscos e os dois caminhos para as demos |
| `m0-relatorio-igdb.md` | Relatório do marco M0 (B-07): termos da IGDB, cobertura dos campos, recortes do catálogo e decisões de dados |

As transcrições e análises das pesquisas de campo (entrevistas na BGS 2026 e
questionário com jogadores) ficam fora deste repositório — são material de
pesquisa acadêmica do TCC, não artefatos de engenharia, e continuam
disponíveis no projeto do Claude usado para planejar o trabalho.

Os diagramas em Mermaid estão dentro da `proposta-tecnica.md` e renderizam
diretamente no GitHub.
