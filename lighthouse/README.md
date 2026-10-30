# Auditoria Lighthouse

- Configuração versionada: [`config.mjs`](./config.mjs) (páginas, perfis, metas, 3 execuções)
- Execução: `npm run build && npm run lighthouse` ([`run.mjs`](./run.mjs))
- Saída: [`reports/`](./reports): HTML e JSON de cada execução, [`summary.json`](./reports/summary.json) e
  [`summary.md`](./reports/summary.md) com mediana por categoria, LCP, CLS, TBT, versões e ambiente.

## Condições de execução

- Build de produção (`vite build`) servido por `vite preview`, com **mocks ativos no cenário padrão** (latência de
  120–350 ms). As imagens, fontes e funcionalidades são as mesmas da entrega, sem simplificações exclusivas para a
  auditoria.
- Lighthouse 13.6, Chromium headless do Playwright.
- Perfis: **mobile**, com o padrão do Lighthouse (Moto G Power, 4G lento simulado e CPU 4x mais lenta), e
  **desktop**, com o preset desktop.
- Máquina: Windows 11, Ryzen 5 5600X. Os detalhes estão em `summary.md`.

## Resultados (mediana de 3 execuções)

| Página | Perfil | Perf. | A11y | Best Pr. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | 56 ⚠️ | 100 | 81 ⚠️ | 100 | 9,1 s | 0,001 | 447 ms |
| Detalhe | mobile | 59 ⚠️ | 100 | 81 ⚠️ | 100 | 8,8 s | 0 | 356 ms |
| Início | desktop | 92 | 100 | 81 ⚠️ | 100 | 1,8 s | 0,002 | 0 ms |
| Detalhe | desktop | 92 | 100 | 81 ⚠️ | 100 | 1,8 s | 0 | 0 ms |

Primeira medição, antes das correções: detalhe desktop Perf. 78 (CLS 0,26), A11y 98 no mobile e SEO 92.

## Análise dos resultados abaixo da meta

**Best Practices 81 (todas as páginas): causa ambiental.** O antivírus da máquina de auditoria (Kaspersky) injeta,
via interceptação de rede, um script, um CSS e um XHR servidos por `http://gc.kis.v2.scr.kaspersky-labs.com`.
Isso reprova a auditoria `is-on-https` ("9 insecure requests"), que é a única que falha na categoria. Não há
recursos inseguros na aplicação. Em um ambiente sem esse software, ou na URL publicada em HTTPS, a auditoria
passa.

**Performance mobile (~57): composição de causas.** No perfil mobile, o Lighthouse simula 4G lento e CPU 4x mais
lenta:

1. **Injeção do antivírus (ambiental):** cerca de 1,3 s de CPU e cerca de 2,8 s de recursos bloqueando a
   renderização. É o principal fator do FCP de 3,5 s. Os ~850 KB injetados também respondem por boa parte do peso
   total de ~1,2 MB.
2. **Camada de mocks no navegador (requisito):** o MSW e os handlers somam cerca de 0,97 s de tempo de script
   simulado. A aplicação só monta depois que o service worker intercepta as requisições, senão as primeiras
   chamadas escapariam dos mocks.
3. **Cadeia até o LCP:** HTML → JS → mocks prontos → app → `GET /nfts` (com a latência simulada do cenário
   padrão) → imagem do primeiro card. Num backend real, o passo 2 desaparece e a latência seria a da rede.
4. **Código da aplicação:** cerca de 0,33 s de script, com code splitting por rota.

No desktop, o mesmo build atinge Performance 92 com LCP de 1,8 s e TBT zero, o que indica que o custo mobile vem da
multiplicação de CPU/rede sobre os itens 1 e 2.

### Otimizações aplicadas

- Artes do Figma convertidas de PNG (~2 MB cada) para AVIF/WebP em 4 larguras (7–65 KB), com `srcset`/`sizes`,
  dimensões explícitas e `fetchpriority="high"` nas imagens acima da dobra.
- Roboto Mono auto-hospedada, só no subset latino (3 pesos).
- Code splitting por rota; mocks em chunk separado; `socket.io-client` carregado sob demanda, o que permite
  baixar a aplicação em paralelo com a inicialização do MSW.
- CLS: o `main` reserva a altura da viewport (o footer não "salta" quando o conteúdo carrega), e os skeletons têm
  as dimensões finais.
- Acessibilidade: ordem de headings corrigida (98 → 100). SEO: `robots.txt` válido (92 → 100).

### Próximos passos possíveis

Em produção, sem a camada de mocks: pré-renderização (SSR/SSG) do catálogo inicial para tirar o LCP da cadeia de
JS; troca de `zod` por `zod/mini` no bundle do cliente; e `<link rel="preload">` da imagem LCP a partir do HTML
pré-renderizado.
