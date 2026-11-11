# Documentação do projeto

| Documento | O que é |
| --- | --- |
| `proposta-conceitual.md` | Versão conceitual da proposta — problema, pesquisas de campo, justificativa e proposta de valor |
| `proposta-tecnica.md` | Plano técnico e de execução. Referência oficial durante a implementação |
| `vetorizacao-tfidf.md` | Vetorização TF-IDF (B-12): descarte, normalização por bloco, medição das configurações, empates, cobertura de etiquetas e jogos da BGS |
| `criterio-indie-casos.md` | Critério indie (B-11, B-59 e B-60): a regra de controle do estúdio, o teste de entrada das grandes empresas, os casos reais conferidos, as medições dos falsos negativos e da regra de controle, as limítrofes recusadas, o levantamento dos estúdios controlados, as exceções e as limitações |
| `recomendacao.md` | Recomendação: o núcleo de pontuação (B-32), com perfil, pontuação, desempate, motivos, "pouco conhecido", lista de populares e as medições de tempo e de empates, e a rota `GET /api/recommendations` (B-33), com a partida a frio, o jogo fora do catálogo e o tempo de resposta |
| `ingestao.md` | Ingestão do catálogo (B-13): como rodar, o fluxo de uma execução, a política de falhas, os alertas de revisão, a popularidade reconstruída e as medições da primeira carga |
| `colecoes.md` | Coleções culturais (B-57): o fluxo da curadoria, a regra de curadoria e de ambientação, as coleções iniciais, as fontes da sugestão e as limitações |
| `precos.md` | Preços da Steam (B-86 a B-88): as decisões, a arquitetura da coleta em lote, a análise de viabilidade da GG.deals, as alternativas e os riscos |
| `m0-relatorio-igdb.md` | Relatório do marco M0 (B-07): termos da IGDB, cobertura dos campos, recortes do catálogo e decisões de dados |

As transcrições e análises das pesquisas de campo (entrevistas na BGS 2026 e
questionário com jogadores) ficam fora deste repositório — são material de
pesquisa acadêmica do TCC, não artefatos de engenharia, e continuam
disponíveis no projeto do Claude usado para planejar o trabalho.

Os diagramas em Mermaid estão dentro da `proposta-tecnica.md` e renderizam
diretamente no GitHub.
