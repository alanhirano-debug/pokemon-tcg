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

### APIs de cartas

Nenhuma chave necessária. Os dados vêm da [TCGdex](https://tcgdex.dev), gratuita e de código aberto, com o idioma na URL (`/v2/pt/`) — por isso as cartas aparecem em português, iguais às que você tem na mão.

A escolha veio de dois problemas com a pokemontcg.io: ela só cataloga cartas em inglês, e passou a devolver erro 500 de forma intermitente depois de virar parte da Scrydex.

A PokéAPI, usada para os sprites e a Pokédex, também não pede chave.

---

## Publicando de graça

**Netlify** — conecte o repositório do GitHub. O `netlify.toml` já define build (`npm run build`), pasta (`dist`) e o redirect de SPA. Adicione as variáveis `VITE_*` em *Site settings → Environment variables*.

**GitHub Pages** — o arquivo `.github/workflows/deploy.yml` já faz tudo. Ative em *Settings → Pages → Source: **GitHub Actions*** e cadastre as variáveis em *Settings → Secrets and variables → Actions*, com os mesmos nomes do `.env`. A partir daí, cada push compila e publica sozinho.

> O Pages **não compila** projeto Vite por conta própria. Mandar o código-fonte novo sem esse workflow deixa o site servindo o build antigo — o sintoma é o app não mudar depois do push.

**Vercel** — importe o repositório; o Vite é detectado sozinho. Adicione as mesmas variáveis em *Settings → Environment variables*.

Depois disso, cada `git push` na branch principal republica o site.

> **Câmera exige HTTPS.** Netlify e Vercel já servem em HTTPS. Em desenvolvimento, `localhost` é tratado como origem segura — mas se você abrir o dev server pelo IP da rede (`192.168.x.x`) para testar no celular, a câmera não abre. Use `npx vite --host` com um túnel HTTPS, ou teste direto no deploy de preview.

---

## Como funciona o cadastro

Coleção e número identificam a carta exata — o par é único dentro de cada
expansão, então não há chute nenhum:

1. **Filtrar a coleção** pela sigla impressa no rodapé da carta (MEG, OBF,
   SVI) ou pelo nome.
2. **Digitar o número** antes da barra. Em `001/132`, digite `001`.
3. **Confirmar** — imagem, raridade, preço convertido pelo dólar do dia, e o
   seletor `−  1  +`.
4. **Adicionar** — se você já tem aquele exemplar exato (mesmo card, condição,
   idioma, reverse), o app **soma a quantidade** em vez de criar uma linha
   duplicada.

O número não distingue acabamento: uma carta normal e a mesma em *reverse
holo* compartilham o número. Por isso a opção fica na tela de confirmação.

Houve uma tentativa de reconhecimento por câmera com OCR. Ela foi removida:
dentro do navegador, a leitura depende demais de luz, foco e fundo para ser
confiável. Reconhecimento de verdade exige comparação de imagem contra um
índice das cartas, que é outro projeto.

## Lista de coleções embutida

`npm run colecoes` baixa as coleções da TCGdex e grava `src/data/colecoes.json`,
que entra no pacote do app. Roda automaticamente antes de `npm run build` e de
`npm run dev`.

Buscar ~170 coleções pela rede a cada abertura da tela era o que travava o
cadastro. Embutida, a lista aparece na hora e funciona offline; uma atualização
em segundo plano busca coleções novas sem segurar a interface.

O script nunca derruba o build: se a API não responder, mantém o arquivo
anterior; se nem esse existir, grava uma lista vazia e o app volta a buscar
pela rede.

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
