# Pokédex TCG

PWA para catalogar sua coleção de cartas Pokémon TCG com um objetivo diferente do usual: **completar a Pokédex através das cartas**. Ter qualquer carta do Bulbasaur já marca o Bulbasaur como obtido — e todas as versões que você tiver dele continuam registradas.

Roda no navegador, instala na tela inicial do celular, funciona offline e publica de graça no Netlify ou Vercel.

---

## Sprites: tudo em 2D

Requisito do projeto: **nenhum modelo 3D**. O conjunto `other/home` da PokéAPI (renders 3D do Pokémon HOME) está explicitamente fora, e a resolução de sprites vive num único lugar — `src/services/sprites.ts`.

Cada Pokémon tem uma **cadeia de fontes**. O componente `<PokemonSprite />` tenta a primeira; se falhar (404, forma sem sprite, offline), desce para a próxima automaticamente:

**Estilo `pixel` (padrão)**

| Ordem | Fonte | Cobertura |
|---|---|---|
| 1 | Showdown animado (`other/showdown/{id}.gif`) | pixel art animado, gerações 1–9 |
| 2 | Black/White (`versions/generation-v/black-white`) | pixel art original dos jogos, nº 1–649 |
| 3 | PokéSprite box icon (jsDelivr) | ícone pixel de caixa, cobre até a 9ª geração |
| 4 | `front_default` | último recurso |

**Estilo `artwork`**

| Ordem | Fonte | Cobertura |
|---|---|---|
| 1 | Official artwork | ilustração 2D estilo Sugimori, nº 1–1025 |
| 2 | cai para a cadeia pixel | — |

O usuário troca entre os dois em **Configurações → Sprites**, e pode desligar a animação para economizar dados.

Dois detalhes que fazem diferença:

- **`image-rendering: pixelated`** (classe `.pixelated`): sem isso o navegador borra o sprite ao ampliar e o pixel art vira mingau.
- **Não obtido = cinza**, com `grayscale(1) brightness(.42)` — a silhueta escura da Pokédex dos jogos, não uma imagem apagada.

O service worker faz `CacheFirst` nas duas origens de sprite. Depois da primeira visita, a grade abre instantaneamente e offline.

---

## Stack

React 18 · Vite · TypeScript · TailwindCSS · Firebase (Auth + Firestore + Storage) · Pokémon TCG API · PokéAPI · vite-plugin-pwa

---

## Estrutura

```
src/
  components/
    layout/     AppShell — navegação lateral (desktop) e barra inferior (mobile)
    pokedex/    PokemonSprite, PokedexCell, PokedexGrid
    ui/         TypeBadge, ProgressRing, StatTile
  contexts/     AuthContext, CollectionContext
  hooks/        usePokedexFilters, useStats
  lib/          firebase, format
  pages/        Login, Pokedex, PokemonDetail, AddCard, Collections,
                MyCards, Wishlist, Stats, Settings
  services/     sprites, pokeapi, tcgapi, cardRecognition,
                collectionService, exportService
  types/        contratos de domínio
```

A regra que mantém isso escalável: **nenhum componente conhece o formato bruto das APIs nem importa `firebase/firestore` direto**. Tudo passa pelos serviços e pelos tipos em `src/types`.

---

## Rodando localmente

```bash
npm install
cp .env.example .env      # preencha as chaves
npm run dev
```

### Firebase

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method**: ative **Google** e **E-mail/senha**.
3. **Firestore Database → Criar banco**, modo produção, região `southamerica-east1`.
4. Cole o conteúdo de `firestore.rules` em **Firestore → Regras** e publique. Elas garantem que cada conta só lê e escreve a própria coleção.
5. **Configurações do projeto → Seus apps → Web**: copie as chaves para o `.env`.

### Pokémon TCG API

Crie uma conta em [dev.pokemontcg.io](https://dev.pokemontcg.io) e cole a chave em `VITE_POKEMONTCG_API_KEY`. Funciona sem chave, mas o limite de requisições é baixo — com o scanner em uso você bate nele rápido.

A PokéAPI não pede chave.

---

## Publicando de graça

**Netlify** — conecte o repositório do GitHub. O `netlify.toml` já define build (`npm run build`), pasta (`dist`) e o redirect de SPA. Adicione as variáveis `VITE_*` em *Site settings → Environment variables*.

**Vercel** — importe o repositório; o Vite é detectado sozinho. Adicione as mesmas variáveis em *Settings → Environment variables*.

Depois disso, cada `git push` na branch principal republica o site.

> **Câmera exige HTTPS.** Netlify e Vercel já servem em HTTPS. Em desenvolvimento, `localhost` é tratado como origem segura — mas se você abrir o dev server pelo IP da rede (`192.168.x.x`) para testar no celular, a câmera não abre. Use `npx vite --host` com um túnel HTTPS, ou teste direto no deploy de preview.

---

## Como funciona o fluxo de escanear

Uma leitura, várias cópias:

1. **Escanear** — abre a câmera traseira e captura um frame.
2. **Reconhecer** — o OCR roda em duas faixas apenas: nome (topo) e número impresso (rodapé). Ler a carta inteira seria mais lento e traria o ruído do texto de ataques.
3. **Buscar** — nome + número consultam a Pokémon TCG API. Mais de um resultado, você escolhe entre as versões.
4. **Confirmar** — imagem, coleção, número, raridade, preço atualizado, e o seletor `−  1  +`.
5. **Adicionar** — se você já tem aquele exemplar exato (mesmo card, condição, idioma, reverse), o app **soma a quantidade** em vez de criar uma linha duplicada.

O reconhecimento por OCR é *best-effort*: iluminação ruim, sleeve refletindo ou arte full-art atrapalham. Por isso a busca por nome digitado está sempre disponível na mesma tela — não é um plano B escondido.

---

## Dados

```
users/{uid}                    settings, favoritePokemon[]
users/{uid}/cards/{cardId}     OwnedCard
users/{uid}/wishlist/{itemId}  WishlistItem
```

Firestore com `persistentLocalCache` ligado: a coleção fica acessível offline e as escritas são reenviadas quando a conexão volta. Não existe botão "salvar" — toda alteração grava sozinha.

A Pokédex nacional (1025 entradas) é baixada uma única vez da PokéAPI e guardada em IndexedDB por 30 dias.

---

## O que ainda não está aqui

Coisas que valem uma segunda rodada, listadas para você não descobrir na hora errada:

- **Virtualização da grade.** 1025 células com `loading="lazy"` seguram bem, mas num celular antigo a rolagem pode engasgar. `@tanstack/react-virtual` resolve.
- **Preços em BRL** usam uma cotação fixa (`USD_BRL` em `tcgapi.ts`) sobre os valores em dólar da API. Trocar por uma cotação ao vivo é uma função.
- **Atualização de preços em lote** — hoje o preço é gravado no momento em que a carta entra. Uma rotina que revisita as cartas antigas ainda não existe.
- **Formas regionais e variantes** (Alolan, Gigantamax) contam como o mesmo número da Pokédex, então dividem a mesma entrada.
