# Análise do Figma — Kurio (NFT Marketplace)

Fonte: arquivo Figma `BaJE9l63IpSjLvbyPP14nW` (cópia de `Ff0SksUi7UFtPWUO8kyNtw`), página "Marketplace de NFTs GreenMint".
Exports em `design/frames/*.png` (escala 1x) e artes em `design/assets/*.png` (1254×1254).

## Frames

| Frame | Node | Tamanho | Arquivo |
|---|---|---|---|
| Desktop / Início | 2:2 | 1440×3668 | desktop-inicio.png |
| Desktop / Detalhes do NFT | 10:244 | 1440×2246 | desktop-detalhe.png |
| Desktop / Carrinho de NFTs | 11:1278 | 1440×1754 | desktop-carrinho.png |
| Desktop / Pagamento | 11:2862 | 1440×1657 | desktop-pagamento.png |
| Desktop / Confirmação de Pedido | 11:4385 | 1440×1657 | desktop-confirmacao.png |
| Desktop / Login (modal sobre Início) | 9:115 | 1440×1981 | desktop-login.png |
| Desktop / Cadastro (modal sobre Início) | 9:1022 | 1440×1981 | desktop-cadastro.png |
| Desktop / Perfil do Colecionador | 9:1238 | 1440×1080 | desktop-perfil.png |
| Desktop / Carteiras | 9:1670 | 1440×1080 | desktop-carteiras.png |
| Mobile / Início | 14:5226 | 414×896 | mobile-inicio.png |
| Mobile / Detalhes do NFT | 15:5536 | 414×896 | mobile-detalhe.png |
| Mobile / Carrinho de NFTs | 16:360 | 414×896 | mobile-carrinho.png |
| Mobile / Pagamento | 16:748 | 414×896 | mobile-pagamento.png |
| Mobile / Login (página) | 16:1022 | 414×896 | mobile-login.png |
| Mobile / Cadastro (página) | 16:1228 | 414×896 | mobile-cadastro.png |

Sem frame mobile: Perfil, Carteiras, Confirmação (README exige que funcionem em mobile).

## Tokens de cor (estilos do arquivo)

| Token | Hex | Uso |
|---|---|---|
| ink (background) | `#140D0A` | fundo da página |
| surface-card | `#241612` | cards, sidebar, modais, footer |
| surface-raised | `#2F1D15` | linhas do carrinho, hover |
| surface-dark | `#38220F` | faixa marrom do footer |
| border | `#3F2319` | bordas de inputs/cards |
| border-soft | `#55321F` | divisores |
| foreground | `#F5F1EB` | texto principal |
| text-secondary | `#CFB28C` | texto de apoio, placeholders |
| secondary | `#B39463` | texto terciário |
| primary | `#D28A4C` | botões, abas ativas, preços |
| primary-light | `#DD9A5F` | gradientes |
| primary-dark | `#C47B3E` | hover/pressed |
| text-accent | `#E89B55` | links, preços em destaque |
| amber | `#E3A44E` | |
| coral / accent | `#EA6B4F` (`#F0805F` em uso) | asterisco de obrigatório |
| success | `#00A66C` | |
| error | `#ED1B2E` | |

Gradientes: botões CTA mobile usam `primary` → `primary/0.8` (e variações 0.4→1). Card hero mobile usa `primary-light/0.43 → primary/0.04`.

Sombras: `0 0 20px #0A0604/45%`, `0 6px 20px #0A0604/45%`, `0 -10px 30px #0A0604/45%` (bottom sheets mobile), `0 4px 12px #140D0A/15%`.

## Tipografia

Fonte única: **Roboto Mono** (400, 500, 700; um uso de 300). Escalas mais usadas:
- Display 43/70 bold (hero), Display 32 bold (hero mobile, ls 10%)
- Heading 24 bold, 28 bold, 26/32 bold
- Title 22 regular, 20 medium/bold
- Body Large 18 bold (preços/nomes, mais usado), 16 regular/medium/bold, 17 bold
- Body 15 regular, 14 regular (lh 16/22/24/30)
- Caption 13, 12; Tiny 10 medium, 9 bold (badges das carteiras)

## Raios
Predominantes: 3–6px (inputs, botões, cards desktop), 8, 16 (cards mobile), 20–40 (bottom sheets/pílulas mobile), full (chips de edição, avatar).

## Assets
- 4 artes de NFT reutilizadas em todas as telas: `emerald-ape`, `nomad-bucket-hat`, `baron-black-ape`, `golden-headphones`. Precisam ser convertidas para WebP/AVIF em tamanhos responsivos (originais têm ~2 MB cada; impacto em Lighthouse).
- Ícones (lucide-compatíveis): busca, carrinho, login, coração, lixeira, olho, menu, redes sociais, Google/Facebook (cores de logo nos estilos).
- Ilustração "THANK YOU" (envelope) no recibo — vetor no Figma, exportar como SVG.

## Componentes recorrentes
- **Header** desktop: logo KURIO, nav (Início/Mercado/Criadores/Aprenda) com sublinhado ativo, busca, carrinho com badge, botão "Entrar".
- **Footer**: 3 features (W/C/D) + newsletter, faixa marrom de contato, 4 colunas de links, "Carteiras compatíveis" (badge METAMASK · WALLETCONNECT · COINBASE), copyright.
- **NFT card**: imagem em moldura `surface-card`, nome, preço (com preço riscado opcional), badge "RARO", ações em hover (carrinho/favorito/zoom).
- **Sidebar de filtros**: Coleções (com contagem), Faixa de preço (slider duplo + Aplicar), Rede (Ethereum/Polygon/Solana).
- **Abas**: Todos os NFTs / Novos lançamentos / Em alta; ordenação "Listados recentemente".
- **Paginação** numérica com seta.
- **Carrossel** "Mais desta coleção" / "Colecionadores também viram" com dots.
- **Stepper de quantidade** (− n +), chips de edição (1/1, 1/10, 1/50, ABERTA).
- **Resumo de valores**: Subtotal, Desconto do lançamento, Taxa de rede ("Taxa estimada"), Total.
- **Modal Login/Cadastro** com tabs "Entrar | Criar conta", social login, barra laranja inferior.
- **Sidebar "Meu perfil"**: Dados do perfil, Carteiras, Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte, Sair.
- **Mobile**: barra inferior (home, favoritos, botão central scan, carrinho, perfil); telas como bottom sheet com cantos 30–40px.

## Observações / possíveis desvios a documentar
- Login/Cadastro desktop são **modais** sobre a Início; mobile são **páginas**. Rotas `/login` e `/cadastro` devem abrir o modal no desktop e a página no mobile.
- Social login (Google/Facebook), "Esqueceu a senha?", Criadores, Aprenda, Atividade, Ofertas, Arquivos, Suporte, newsletter: fora do escopo → devem indicar indisponibilidade, não sucesso.
- Formulário de Pagamento repete campos de carteira (rede, endereço, tipo, ENS, código de indicação) — pré-preencher a partir das carteiras cadastradas.
- Inconsistências do layout: IDs de token divergentes entre telas (#0009 vs #0314), "Desconto (-) 00.00", "Ordenar por: Listados recentemente" truncado, header mostra "Entrar" mesmo logado em Perfil. Corrigir e registrar no ARCHITECTURE.md.
- Contraste: `#B39463` sobre `#241612` e o texto escuro sobre botão `#D28A4C` precisam ser verificados (meta a11y ≥ 95).
