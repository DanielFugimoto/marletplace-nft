# Kurio — Marketplace de NFTs

Implementação do desafio de frontend **NFT Marketplace** em React + TypeScript, fiel ao layout do Figma, com
backend inteiramente simulado na camada de rede (MSW) — REST e Socket.IO.

- **Arquitetura, contratos, cache e tempo real:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Análise do Figma (tokens, frames, assets):** [design/FIGMA.md](./design/FIGMA.md)
- **Lighthouse (resultados e análise):** [lighthouse/README.md](./lighthouse/README.md)

## Stack

| Responsabilidade | Tecnologia |
|---|---|
| Interface | React 19 + TypeScript 7 (estrito) |
| Build | Vite 8 |
| Roteamento | TanStack Router (rotas por arquivo, search params validados com zod) |
| Estado remoto | TanStack Query 5 |
| HTTP | Axios (cliente único em `src/api/http.ts`) |
| Tempo real | socket.io-client 4 |
| Estilo / componentes | Tailwind CSS 4 + shadcn/ui (Radix) adaptados à identidade Kurio |
| Formulários | react-hook-form + zod (mesmos schemas do contrato) |
| Mocking | MSW 2 + `@mswjs/socket.io-binding` |
| Testes E2E / visual | Playwright |
| Auditoria | Lighthouse 13 |

## Setup

Requisitos: **Node 22+** e npm.

```bash
npm install
npx playwright install chromium   # navegador dos testes e da auditoria
npm run dev                        # http://localhost:5173 com mocks ativos
```

Nenhum serviço externo é necessário: tudo roda a partir de um checkout limpo.

### Variáveis de ambiente

Arquivos `.env.development` / `.env.production` já versionados (veja `.env.example`):

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | Ativa a camada MSW (REST + Socket.IO). Também ativa no build de demonstração. |
| `VITE_API_URL` | `/api` | Base das chamadas REST. |
| `VITE_SOCKET_URL` | *(vazio)* | URL do Socket.IO; vazio = mesma origem. |

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Gera rotas, verifica tipos e faz o build otimizado (`dist/`) |
| `npm run preview` | Serve o build em http://localhost:4173 |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | Lint (oxlint) |
| `npm run test:e2e` | Playwright (build + preview automáticos), Chromium desktop 1440 e mobile 390 |
| `npm run test:e2e:update` | Atualiza as baselines de regressão visual |
| `npm run test:report` | Abre o relatório HTML (traces/vídeos das falhas em `test-results/`) |
| `npm run lighthouse` | Auditoria Lighthouse (rode `npm run build` antes) |
| `npm run images` | Regenera as imagens responsivas (AVIF/WebP) a partir de `design/assets` |

## Credenciais fictícias

| Usuário | E-mail | Senha | Observação |
|---|---|---|---|
| Ana Ribeiro | `ana@kurio.dev` | `Kurio@123` | Carteiras principal (MetaMask/Ethereum) e secundária (Coinbase/Polygon), 2 favoritos |
| Bruno Costa | `bruno@kurio.dev` | `Kurio@123` | Carteira principal (WalletConnect/Ethereum), 1 favorito |

Senhas são armazenadas apenas como hash SHA-256 com salt no banco simulado. Cupons de demonstração: `KURIO10`
(10%), `GENESIS` (0.05 ETH), `VERAO2025` (expirado); qualquer outro é inválido.

## Cenários de mock

Selecione um cenário adicionando `?mock=<id>` a qualquer URL (ele persiste até ser trocado) ou via
`POST /api/__mock/scenario { "scenario": "<id>" }`.

| id | Efeito |
|---|---|
| `default` | Sucesso, latência variável curta (120–350 ms) |
| `empty` | Catálogo vazio |
| `slow` | Toda resposta leva ~2,5 s (skeletons) |
| `variable-latency` | Latência entre 200 ms e 3 s (determinística) |
| `out-of-order` | Consultas do catálogo mais novas respondem antes das antigas |
| `offline` | Toda chamada REST falha com erro de rede |
| `server-error` | Catálogo e detalhe respondem 500 |
| `flaky-catalog` | 3 primeiras consultas do catálogo respondem 503, depois normaliza (retry automático) |
| `session-expired` | Sessões expiram 60 s após o login |
| `favorites-failure` | Favoritar responde 500 (rollback otimista) |
| `price-change-checkout` | Preço do 1º item sobe 10% no momento da confirmação |
| `sold-out-checkout` | Edição do 1º item esgota no momento da confirmação |
| `order-timeout` | Pedido é criado mas a resposta não chega a tempo; nova tentativa recupera o mesmo pedido |
| `payment-declined` | Pedidos ficam pendentes e são recusados |
| `wallet-rejected` | A carteira recusa a conexão |

**Reset:** `POST /api/__mock/reset` (opcional `{ "scenario": "<id>" }`) restaura integralmente o banco simulado e o
cenário. Alternativamente, limpe o localStorage do site.

### Plano de controle (`/api/__mock/*`)

Disponível só na camada de mocks, usado pelos testes e útil em demonstração (DevTools → Console → `fetch(...)`):

| Endpoint | Efeito |
|---|---|
| `GET /state` | Configuração ativa, cenários e sockets conectados |
| `POST /config` | Ajuste fino: `{ latency, flags: { orderResolveMs, sessionTtlMs, ... } }` |
| `POST /faults` / `DELETE /faults` | Injeta/remove falhas: `{ method, path, action: { type: 'status', status: 503 }, times }` |
| `POST /nfts/:id` | Altera `price`/`available` de uma edição e emite `nft.updated` |
| `POST /events/replay` | Reenvia um evento já entregue (duplicado) |
| `POST /events/stale/:id` | Envia `nft.updated` com versão antiga |
| `POST /realtime/drop` | Derruba os sockets e recusa reconexão por `{ ms }` |
| `POST /sessions/expire` | Expira todas as sessões |
| `POST /wallet-connections/drop` | Desconecta todas as carteiras |

## Reproduzindo os fluxos de falha

Exemplos (com a app aberta, logado como Ana):

```js
// Alteração de preço de um item do carrinho durante a navegação (via Socket.IO)
fetch('/api/__mock/nfts/emerald-ape-042', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price: '1.35' }) })
// Edição esgotando
fetch('/api/__mock/nfts/emerald-ape-042', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editionId: '1-50', available: 0 }) })
// Queda do tempo real por 5 s
fetch('/api/__mock/realtime/drop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ms: 5000 }) })
// Expirar a sessão
fetch('/api/__mock/sessions/expire', { method: 'POST' })
```

- **Timeout + idempotência:** abra `/?mock=order-timeout`, finalize uma compra; a UI mostra "Enviando pedido…", o
  cliente reenvia com a mesma chave após 8 s e chega ao mesmo pedido (há apenas 1 pedido).
- **Pagamento recusado:** `/?mock=payment-declined` → a confirmação mostra "Pagamento recusado" e o carrinho é preservado.
- **Pedido pendente + reconexão:** finalize uma compra e recarregue a página enquanto "Aguardando confirmação na
  rede…" estiver visível; o estado é recuperado sem criar outra compra.
- **Erros/skeletons:** `/?mock=slow`, `/?mock=offline`, `/?mock=server-error`, `/?mock=flaky-catalog`.

## Testes

```bash
npm run test:e2e
```

110 cenários (100 executados + 10 específicos de viewport) em `e2e/`, cada um partindo de estado isolado (contexto
novo do navegador + reset do banco simulado). Cobrem catálogo/URL/histórico, respostas fora de ordem, detalhe e
404, favoritos com rollback, carrinho e cupons, merge do carrinho no login, compra completa, recusa, cliques
repetidos, timeout com relógio controlado (`page.clock`), carteira recusada, preço/disponibilidade alterados via
Socket.IO, eventos duplicados/antigos, queda de conexão com pedido pendente, perfil/avatar/senha/carteiras,
teclado/foco/diálogos/overflow e regressão visual (baselines em `e2e/__screenshots__`). Requests REST passam pelos
handlers MSW e eventos pelo `socket.io-client` real.

## Deploy

Pensado para VPS com **Coolify** (ou qualquer host Docker):

- `Dockerfile` (multi-stage): `npm ci` + `npm run build` em Node 22, servido por Nginx na porta **80**.
- `deploy/nginx.conf`: fallback SPA (acesso direto/refresh de qualquer rota recebe `index.html`), cache imutável
  para `/assets/*` (nomes com hash) e `no-cache` para `index.html` e `mockServiceWorker.js`.

No Coolify: *New Resource → Public/Private Repository*, build pack **Dockerfile**, porta exposta `80` e um domínio
com HTTPS (o proxy do Coolify emite o certificado Let's Encrypt).

> **HTTPS é obrigatório.** Toda a API é simulada por MSW, que roda num Service Worker — e navegadores só registram
> Service Workers em HTTPS (ou `localhost`). Servida por `http://IP`, a aplicação não inicializa.

Sem Docker: `npm run build` e sirva `dist/` com o mesmo `deploy/nginx.conf` (ajuste `root`).
