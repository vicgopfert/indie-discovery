# Preços da Steam (B-86 a B-88)

Decidido em 11/11/2026, antes de implementar. O preço da Steam entra na ficha (B-86), é atualizado
por uma rodada diária (B-87) e alimenta o filtro "Em promoção" no catálogo (B-88). Este documento
traz as decisões, a arquitetura e a análise da GG.deals, consultada como fonte de outras lojas e do
menor preço histórico. As medições entram aqui com a sonda do B-86 e a rodada do B-87.

## 1. Objetivo e decisões

O preço foi citado como barreira por 16,7% dos jogadores (proposta conceitual). A plataforma não
muda o preço, mas tira um passo de quem já tem interesse e mostra as promoções.

Decisões do autor (11/11/2026):

- **Só a Steam agora.** O preço vem da rota `IStoreBrowseService/GetItems`, que a ingestão já
  chama em lotes de 50 com `country_code: 'BR'` para as etiquetas (`docs/etiquetas.md`, seção 10).
  As opções de compra são pedidas na mesma requisição (`include_all_purchase_options`, a confirmar
  na sonda do B-86). Não entra fonte nova nem chave nova.
- **Nenhuma requisição de usuário consulta fonte de preço** (extensão do RNF-02). Os preços são
  coletados em lote pelo workflow "Ingestão" e gravados no banco; a API só lê do banco.
- **Só preço de loja oficial.** Nunca keyshops, que são revendas de chaves fora das lojas
  oficiais: a venda nelas muitas vezes não paga o estúdio, o que vai contra o propósito da
  plataforma. Nenhum link de afiliado (princípio 7 da proposta conceitual; objeção "indicação por
  comissão" do questionário).
- **Sem "média de preço".** Ninguém paga a média. Mostra-se o preço de cada loja quando houver
  mais de uma fonte; por enquanto, só a Steam.
- **Menor preço fica para a Fase B**, com o histórico completo de uma fonte externa (F-37). Um
  histórico próprio, parcial, não é mostrado agora.
- **Filtro "Em promoção" no catálogo como P0** (B-88). É navegação, então entra no plano de corte
  junto com os outros filtros.
- **Congelamento do modelo:** é compatível com ele. O preço não entra no vetor, na pontuação nem
  nas prateleiras. Uma prateleira "Em promoção no seu gosto" seria regra nova e fica para a Fase B
  (F-37).

## 2. Arquitetura

- **Coleta em lote:** o GitHub Actions busca os preços, grava no Neon, e a API lê do banco. A
  instância do Render não faz nenhuma requisição externa de preço.
- **Rodada diária (B-87):** depois do início das promoções da Steam, às 10h no horário do
  Pacífico, entre 14h e 15h em Brasília, conforme o horário de verão americano.
- **Custo estimado de uma rodada só de preços:** o mesmo da coleta de etiquetas, que levou 452 s
  para 21.912 ids na primeira carga em produção (08/11/2026), a 1 requisição por segundo
  (`docs/etiquetas.md`, seção 10). São cerca de 440 requisições por rodada, em lotes de 50, dentro
  do limite de 100 mil chamadas por dia dos termos da Web API (`docs/etiquetas.md`, seção 8). A
  medição real fica para o B-87.
- **Termos da Web API:** permitem mostrar os dados aos usuários do site, não redistribuí-los. O
  preço é mostrado na ficha, como as etiquetas.

## 3. Análise de viabilidade da GG.deals (consultada em 11/11/2026)

**O que oferece:**

- consulta por id da Steam, até 100 ids por requisição;
- região `br`;
- por jogo: menor preço atual no varejo, menor preço atual em keyshops, menores preços históricos
  (varejo e keyshops), moeda e URL na GG.deals;
- histórico desde 2014, em mais de 60 lojas.

**Limites:** 100 registros por minuto e 1.000 por hora. Cada id conta como um registro, e
requisições inválidas também contam.

- Uma atualização do catálogo inteiro (cerca de 21,9 mil ids da Steam) leva cerca de 22 horas.
- Atualizar todo dia exigiria rodadas a cada hora, no limite exato da cota, sem folga para falhas.
- Alternativa: atualizar só um subconjunto, como os jogos nas bibliotecas dos usuários, nas
  recomendações ou nas fichas mais vistas.

**Termos:** o acesso gratuito é só para uso pessoal e hobby, e o uso comercial exige contato. Um
site público de TCC sem fins lucrativos é zona cinzenta: só entra com a confirmação deles por
escrito. A página da API não traz exigências de atribuição ou de link; conferir nos termos gerais
antes de qualquer uso.

**Keyshops:** a resposta traz os campos separados. Se a GG.deals for adotada, os campos de keyshops
são descartados na ingestão e nunca gravados.

**Conclusão:** inviável como fonte principal antes da defesa, pelo limite e pelos termos. É
candidata ao histórico completo na Fase B (F-37), com os termos confirmados e atualização por
subconjunto.

## 4. Alternativas registradas, não avaliadas a fundo

- **IsThereAnyDeal:** tem menor preço histórico (`historyLow`), só para lojas de PC. Termos e
  limites não conferidos.
- **Consoles:** não há API oficial e gratuita de preços da PlayStation Store, da eShop ou da
  Microsoft Store. Serviços de terceiros, como o PlatPrices, funcionam com chave, plano e cota.

## 5. Riscos

A rota da Steam não tem documentação pública (R-15 da proposta técnica). Se ela parar de devolver
preços, os preços gravados ficam, com a data da coleta, e o B-87 registra a falha no resumo da
execução.
