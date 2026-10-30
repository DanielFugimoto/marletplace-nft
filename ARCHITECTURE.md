# Arquitetura

## Visão geral

```
src/
  api/            contratos zod, cliente Axios, erros tipados, chaves de cache
  mocks/          backend simulado (MSW): banco, handlers REST, broker Socket.IO, cenários, plano de controle
  realtime/       cliente Socket.IO, deduplicação/versão, ponte com o TanStack Query
  features/       catalog, nft, cart, checkout, auth, account, favorites (queries, mutations, telas)
  components/     ui/ (shadcn adaptado), layout, estados (erro/vazio), campos de formulário
  routes/         rotas por arquivo do TanStack Router (_auth = área autenticada)
e2e/              Playwright (fixtures, specs, baselines visuais)
lighthouse/       configuração e relatórios da auditoria
design/           exports do Figma, assets e análise
```

Fluxo de dados: **componente → hook (TanStack Query) → função de API (Axios) → contrato zod → MSW handler →
banco simulado**. O broker de tempo real lê/escreve o mesmo banco, então toda mudança aparece tanto na resposta
REST quanto no evento correspondente.

O `main.tsx` inicia o MSW **antes** de importar a aplicação: o `engine.io-client` captura o construtor global de
`WebSocket` no momento do import, então a app só é carregada depois que o MSW o substitui.

## Contratos REST

Todos os contratos estão em `src/api/contracts/` e são reutilizados pelo cliente (validação das respostas), pelos
formulários (validação de entrada) e pelos handlers MSW (validação das requisições). Valores em ETH trafegam como
strings decimais e só são combinados com `big.js` (`src/lib/money.ts`); quantidades são inteiras.

| Recurso | Método e rota | Notas |
|---|---|---|
| Sessão | `POST /auth/register` | 201 + sessão; 409 `EMAIL_TAKEN`/`USERNAME_TAKEN`; 422 validação. Mescla o carrinho do visitante (`X-Cart-Id`). |
| | `POST /auth/login` | 401 `INVALID_CREDENTIALS`. Retorna `cartMerged`. |
| | `GET /auth/session` | 401 `SESSION_EXPIRED`/`UNAUTHENTICATED` |
| | `POST /auth/logout` | 204; derruba os sockets do usuário |
| NFTs | `GET /nfts?q&categories&networks&minPrice&maxPrice&tab&sort&collection&exclude&page&pageSize` | Paginado, com facetas (contagens ignoram a própria dimensão, para filtros combináveis) |
| | `GET /nfts/:id` | 404 `NOT_FOUND` |
| Favoritos | `GET /me/favorites`, `PUT/DELETE /me/favorites/:nftId` | Retornam a lista completa |
| Carrinho | `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id`, `POST /cart/acknowledge` | 409 `QUANTITY_LIMIT`/`EDITION_UNAVAILABLE`. Toda mutation devolve o carrinho inteiro. |
| Cupom | `PUT/DELETE /cart/coupon` | 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| Cotação | `GET /cart/quote?network=` | Subtotal, desconto, taxa, total, problemas por linha e `id` (impressão digital de tudo que afeta o total) |
| Pedidos | `POST /orders` (header `Idempotency-Key`) | 201 novo / 200 mesma chave+corpo / 409 `IDEMPOTENCY_CONFLICT` / 409 `QUOTE_CHANGED`/`AVAILABILITY_CONFLICT` (com a nova cotação) / 409 `WALLET_DISCONNECTED` |
| | `GET /orders`, `GET /orders/:id` | Pedidos de outro usuário respondem 404 (não 403, para não vazar ids) |
| Perfil | `GET/PATCH /me/profile`, `PUT/DELETE /me/avatar`, `POST /me/password` | 409 conflito, 422 `INVALID_PASSWORD` |
| Carteiras | `GET/POST /me/wallets`, `PUT /me/wallets/:id` | Slots `primary`/`secondary` |
| Conexão | `POST /wallet-connections`, `GET/DELETE /wallet-connections/:id` | 403 `WALLET_REJECTED` |

Erros têm sempre o formato `{ error: { code, message, fieldErrors?, details? } }`. O cliente converte qualquer falha
em `ApiError` (`src/api/errors.ts`) com `code` estável, incluindo `NETWORK`, `TIMEOUT` e `INVALID_RESPONSE`
(resposta que viola o contrato). Respostas: 401 sessão inválida/expirada, 403 sem permissão, 404 inexistente, 409
conflito de disponibilidade/idempotência, 422 validação, 5xx/503 falha transitória.

## Eventos (Socket.IO)

Envelope comum (`src/api/contracts/events.ts`):

```ts
{ id: 'evt-000042', type: 'nft.updated' | 'order.updated', resource: { type, id }, version: number, occurredAt, data }
```

| Evento | Audiência | `data` | Efeito no cliente |
|---|---|---|---|
| `nft.updated` | todos | preço, preço anterior, esgotado, preço/disponibilidade por edição | Atualiza detalhe e cards (patch no cache); invalida carrinho/cotação; avisa se o item está no carrinho |
| `order.updated` | só os sockets do dono | `userId`, status, hash, motivo | Atualiza o pedido, busca o recibo completo, invalida o carrinho se confirmado |

Regras do cliente (`src/realtime/client.ts`):

- **Duplicados:** ids já vistos são descartados (janela de 500 ids).
- **Antigos:** cada recurso guarda a maior versão aplicada (também a versão que já está no cache); eventos com
  versão menor ou igual são ignorados, então um estado mais novo nunca regride.
- **Isolamento:** o socket é autenticado com o token da sessão (pacote CONNECT); o servidor só entrega
  `order.updated` ao dono e o cliente confere `data.userId` com a sessão atual. Logout ou troca de usuário fecham
  o socket, removem os listeners e zeram o estado de deduplicação.
- **Reconexão:** após uma queda, no `connect` seguinte todas as queries ativas, públicas e privadas, são
  invalidadas. O REST volta a ser a fonte de verdade e eventos perdidos durante a queda não deixam a tela
  desatualizada.
- **Ciclo de vida:** um socket por sessão (`RealtimeBridge`), liberado no unmount ou quando o token muda.

### Transporte nos mocks e suas limitações

O broker usa `ws.link` do MSW + `@mswjs/socket.io-binding`:

- apenas transporte **websocket** (o cliente usa `transports: ['websocket']`; long-polling não é simulado);
- apenas o namespace padrão, sem rooms/acks;
- o binding ignora o payload `auth` do CONNECT, então o token é lido do pacote `40{...}`;
- o binding não envia pings do Engine.IO; o broker envia `2` a cada 25 s para o cliente não encerrar a conexão;
- o MSW remove o prefixo `/socket.io/` da URL antes de comparar, então o link aponta só para a origem;
- a "queda" simulada (`/__mock/realtime/drop`) deixa o handshake seguir para a origem real (sem servidor
  Socket.IO), o que gera um erro de conexão genuíno e o backoff normal do cliente;
- o broker vive na aba: abas diferentes têm brokers independentes (o banco é compartilhado via localStorage, mas os
  eventos não cruzam abas).

## Sessão

- Login/cadastro devolvem um token opaco, guardado em `localStorage` (`kurio:session`, só token/userId/validade;
  dados do usuário sempre vêm da API). A sessão é recuperada no refresh via `GET /auth/session`.
- Rotas privadas (`/pagamento`, `/pedido/:id`, `/perfil`, `/perfil/carteiras`, `/favoritos`) ficam sob o layout
  `_auth`, cujo `beforeLoad` valida a sessão e redireciona para `/login?redirect=<url atual>`.
- **Expiração:** qualquer 401 numa requisição autenticada aciona um handler global único. Ele encerra a sessão,
  limpa os dados privados, avisa o usuário e navega para `/login?redirect=…&reason=expired`. Depois do login,
  o usuário volta exatamente para onde estava. No checkout, o rascunho do formulário fica em `sessionStorage`
  por usuário e é restaurado.
- **Logout/troca de usuário:** remove a subárvore `['private']` do cache, cancela requisições em andamento, fecha o
  socket e sincroniza outras abas via evento `storage`.

## Carrinho

- O carrinho vive **no servidor**. O visitante recebe um `cartId` (header `X-Cart-Id`, persistido em
  localStorage); o usuário autenticado tem o carrinho vinculado à conta. No login ou cadastro, o carrinho do
  visitante é mesclado ao da conta, respeitando os limites de cada edição.
- Cada item guarda o `acknowledgedPrice`, que é o preço que o colecionador viu. Quando o preço atual muda,
  aparece um aviso, e o checkout fica bloqueado até ele confirmar ("Entendi, usar valores atuais", via
  `POST /cart/acknowledge`). O mesmo vale para disponibilidade menor que a quantidade.
- Subtotal, desconto, taxa e total exibidos vêm sempre da cotação da API; o cliente não recalcula valores de
  negócio.
- Na confirmação de um pedido, o servidor remove do carrinho **apenas as quantidades compradas**; em recusa ou
  falha nada muda.

## Checkout e idempotência

1. O formulário é validado com o mesmo schema do contrato. A carteira cadastrada selecionada preenche os campos.
2. **Conectar:** `POST /wallet-connections`. Recusa e desconexão são tratadas.
3. **Revisar:** o diálogo mostra a cotação atual e guarda o id da cotação revisada. Se a cotação mudar
   (evento de socket, conflito 409), o botão de pagar trava até o colecionador confirmar os novos valores.
4. **Enviar:** a tentativa de checkout fixa uma `Idempotency-Key` ao corpo exato da requisição
   (`localStorage`). Cliques repetidos são bloqueados pelo estado da mutation. Timeouts e falhas transitórias são
   reenviados automaticamente com a mesma chave e o mesmo corpo, até 2 vezes, e "Tentar novamente" também
   reaproveita a chave. O servidor devolve o pedido já criado, nunca um segundo.
5. **Pedido:** o pedido começa `pending`; `order.updated` (ou o polling de fallback a cada 4 s) leva a
   `confirmed`/`rejected`, que são terminais. O recibo é um snapshot gravado na criação do pedido, então mudanças
   posteriores no catálogo não alteram seus valores. A confirmação só é exibida para pedido `confirmed`. Um
   marcador de pedido pendente permite retomar após refresh ou reconexão.

## Estratégia de cache (TanStack Query)

| Aspecto | Política |
|---|---|
| Chaves | `['public', 'nfts', ...]` para dados públicos; `['private', <userId \| guest:cartId>, ...]` para dados privados, isolados por usuário e pelos parâmetros da consulta |
| `staleTime` | 30 s (catálogo/detalhe/padrão), 15 s carrinho, 0 cotação, 5 min sessão |
| `gcTime` | 5 min |
| Retries de query | Até 2, com backoff exponencial (máx. 4 s), **só** para falhas transitórias (rede, timeout, 5xx, 408, 429). 4xx não é retentado. |
| Retries de mutation | Nenhum automático (exceto o reenvio idempotente do pedido, descrito acima) |
| Respostas obsoletas | `AbortSignal` do Query repassado ao Axios cancela requisições superadas; como a chave inclui os parâmetros, uma resposta atrasada só pode cair na própria entrada do cache, nunca na consulta atual (testado com o cenário `out-of-order`) |
| Transições | `keepPreviousData` no catálogo (lista anterior esmaecida + `aria-busy`); skeletons só no primeiro carregamento |
| Invalidação | Mutations do carrinho gravam o carrinho retornado e invalidam a cotação; perfil invalida sessão/carteiras; favoritos re-sincronizam ao fim da última mutation concorrente; eventos fazem patch (NFT) ou invalidam (carrinho, pedido) |
| Otimista | Favoritos: atualização imediata, rollback em erro, feedback acessível |
| Timeout | Implementado com `setTimeout` + `AbortController` (não o `timeout` nativo do XHR) para que `page.clock` controle o tempo nos testes |

## Mocks (MSW)

- **Banco simulado** (`src/mocks/db`): 45 NFTs gerados de forma determinística (os 9 do Figma com preços exatos),
  4 edições cada, 2 usuários, carteiras, favoritos, carrinhos, conexões e pedidos. É persistido em localStorage
  para sobreviver a refresh, e o reset restaura a semente exata.
- **Rede:** um handler `http.all('/api/*')` roda antes de todos os outros e aplica a latência do cenário (fixa,
  variável determinística ou "fora de ordem") e as regras de falha (erro de rede, timeout ou status HTTP,
  opcionalmente limitadas a N ocorrências).
- **Liquidação de pedidos:** um timer liquida o pedido em `orderResolveMs`. A liquidação também acontece na leitura
  (`GET`) e é retomada no boot, então funciona após refresh.
- Componentes, hooks e o cliente Axios não contêm dados fictícios nem caminhos alternativos: toda simulação está em
  `src/mocks`. A camada é ativada por `VITE_ENABLE_MOCKS` e está presente no build de demonstração.

## Decisões de UX e desvios do Figma

- **Login/Cadastro:** no desktop são um modal sobre a Início, como no Figma; no mobile são páginas. As duas formas
  são acessíveis por rota (`/login`, `/cadastro`).
- **Busca no catálogo:** o desktop do Figma não mostra campo de busca no catálogo, só o ícone no header. Adicionei
  um campo acima da grade; o ícone do header leva até ele.
- **Revisão antes do envio:** o Figma vai direto de "Confirmar compra" ao recibo. Adicionei um diálogo de revisão
  com a cotação atual, exigido pelo enunciado.
- **Carteiras no pagamento:** o desktop do Figma lista provedores (MetaMask/Coinbase…) em "Carteira e rede"; usei
  as **carteiras cadastradas**, como no frame mobile e no enunciado. O provedor vem do campo "Tipo de carteira".
- **"Usar outra carteira?"** virou a escolha entre a carteira principal e a secundária.
- **Contagens das facetas** ("Arte digital (33)") vêm dos dados simulados, não dos números do layout.
- **Inconsistências do layout corrigidas:** IDs de token divergentes entre telas, "Desconto (-) 00.00" (exibido
  como `0.00`), header com "Entrar" em telas autenticadas (mostra o nome do colecionador).
- **Fora do escopo:** login social, "Esqueceu a senha?", newsletter, Criadores, Aprenda, Atividade, Ofertas,
  Arquivos, Suporte, Diário da Cunhagem e QR code mostram um aviso de indisponibilidade e nunca simulam sucesso.
  Links de redes sociais e de compartilhamento abrem os sites reais em nova aba. O link de explorador da transação
  é simulado e identificado como tal.
- **Telas sem frame mobile** (perfil, carteiras, confirmação): seguem o padrão mobile, com menu do perfil em pílulas
  roláveis, formulário em coluna única e recibo em cartão.
- **Carrossel do hero:** sem rotação automática, para não mover conteúdo sem ação do usuário.

## Acessibilidade

- Link "Pular para o conteúdo", foco visível global (`:focus-visible` em `--ring`), navegação completa por
  teclado.
- Diálogos e drawers (Radix) prendem o foco e devolvem ao gatilho. Quando um diálogo é aberto por submissão de
  formulário, o foco volta explicitamente ao botão de envio.
- Campos com `label` associada, `aria-invalid` e `aria-describedby` apontando para a mensagem de erro; erros de
  servidor são mapeados para os campos e focam o primeiro inválido.
- Feedback de mutations e de eventos em tempo real via toasts (região `aria-live` do Sonner). A contagem de
  resultados do catálogo e os totais são anunciados (`aria-live="polite"`).
- Estados não dependem só de cor: filtros ativos têm marcador e `aria-pressed`, edições esgotadas são riscadas e
  têm texto "(esgotada)", preços antigos têm texto alternativo.
- Imagens de NFT têm texto alternativo descritivo; imagens decorativas usam `alt=""`.
- `prefers-reduced-motion` desliga animações, inclusive o shimmer dos skeletons. Skeletons reservam as dimensões
  finais para evitar layout shift.
- Ajustes em relação ao layout: o texto terciário usa `#B39463`/`#CFB28C` sobre fundos escuros (contraste ≥ 4.5:1)
  e o texto sobre botões cobre usa `#140D0A`.

## Performance

- Imagens: as 4 artes do Figma (~2 MB cada em PNG) viram AVIF/WebP em 160/320/640/960 px (7–65 KB), servidas com
  `srcset`/`sizes`, `width`/`height` explícitos e `fetchpriority="high"` no LCP (`scripts/build-images.mjs`).
- Fontes: só o subset latino da Roboto Mono (400/500/700), auto-hospedado.
- Code splitting por rota (TanStack Router `autoCodeSplitting`) e a camada de mocks em chunk separado.
- Resultados e análise: [`lighthouse/README.md`](./lighthouse/README.md).

## Limitações conhecidas

- Os mocks rodam no navegador: os dados são por navegador/origem, e o "servidor" vive enquanto a aba estiver
  aberta. A liquidação de pedidos é retomada no próximo carregamento.
- Valores em ETH usam `big.js` com 18 casas; a exibição corta zeros à direita mantendo no mínimo 2 casas.
- O hash de senha nos mocks é SHA-256 com salt, suficiente para não guardar texto puro numa simulação, mas não é
  um KDF de produção.
