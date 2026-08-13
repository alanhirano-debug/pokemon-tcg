import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info, Minus, Plus, RotateCcw, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '@/contexts/CollectionContext';
import { PokemonSprite } from '@/components/pokedex/PokemonSprite';
import { BuscaPorNumero } from '@/components/cards/BuscaPorNumero';
import { addCards } from '@/services/collectionService';
import { toOwnedCard, type TcgCard } from '@/services/tcgapi';
import { cartasDaColecao, hidratarCartas } from '@/services/tcgdex';
import { CONDITION_LABEL, LANGUAGE_LABEL, brl, dexNumber } from '@/lib/format';
import type { CardCondition, CardLanguage, SpriteStyle } from '@/types';

type Step = 'buscar' | 'picking' | 'confirm' | 'done';

export function AddCardPage() {
  const { user } = useAuth();
  const { cards, pokedex, settings } = useCollection();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('buscar');
  const [status, setStatus] = useState<string | null>(null);
  const [matches, setMatches] = useState<TcgCard[]>([]);
  const [selected, setSelected] = useState<TcgCard | null>(null);
  const [manual, setManual] = useState('');
  const [buscando, setBuscando] = useState(false);

  // Dados do exemplar — escolhidos uma vez, valem para todas as cópias
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<CardCondition>('NM');
  const [language, setLanguage] = useState<CardLanguage>('PT');
  const [isReverse, setIsReverse] = useState(false);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  // Guarda o status ANTES de gravar — depois do addCards a assinatura do
  // Firestore atualiza `cards` e o Pokémon deixaria de parecer inédito.
  const [wasNewToDex, setWasNewToDex] = useState(false);

  // Situação do Pokémon desta carta na Pokédex do usuário.
  const pokedexId = selected?.nationalPokedexNumbers?.[0] ?? 0;
  const dexEntry = pokedex.find((p) => p.id === pokedexId);
  const ownedOfPokemon = pokedexId > 0 ? cards.filter((c) => c.pokedexId === pokedexId) : [];
  const copiesOfPokemon = ownedOfPokemon.reduce((sum, c) => sum + c.quantity, 0);
  const isNewToDex = pokedexId > 0 && ownedOfPokemon.length === 0;
  const hasNoDexEntry = Boolean(selected) && pokedexId === 0;

  // Coleções onde o usuário já tem cartas — sobem para o topo da lista.
  const colecoesUsadas = [...new Set(cards.map((c) => c.setId))];

  function handleResults(resultados: TcgCard[], termo: string) {
    if (resultados.length === 0) {
      setStatus(`Nenhuma carta encontrada para "${termo}".`);
      return;
    }
    if (resultados.length === 1) {
      setSelected(resultados[0]);
      setStep('confirm');
      return;
    }
    // Mesmo número pode ter variações (normal e reverse, por exemplo).
    setMatches(resultados);
    setStep('picking');
  }

  async function buscarPorNome() {
    if (!manual.trim()) return;
    setBuscando(true);
    setStatus('Buscando…');
    try {
      const ultima = localStorage.getItem('pokedex-tcg:ultima-colecao');
      if (!ultima) {
        setStatus('Escolha uma coleção acima antes de buscar pelo nome.');
        return;
      }
      const termo = manual.trim().toLowerCase();
      const todas = await cartasDaColecao(ultima);
      const encontradas = todas.filter((c) => c.name.toLowerCase().includes(termo));
      // A lista da coleção não traz o dexId de cada carta — sem isso a
      // carta seria salva sem vínculo com o Pokémon (ver hidratarCartas).
      const resultados = await hidratarCartas(encontradas);
      setStatus(null);
      handleResults(resultados, manual);
    } catch (err: any) {
      setStatus(err?.message ?? 'A busca falhou. Verifique sua conexão.');
    } finally {
      setBuscando(false);
    }
  }

  async function confirmAdd() {
    if (!user || !selected || salvando) return;

    setSalvando(true);
    setErroSalvar(null);

    try {
      const unitPrice = Number(valor.replace(',', '.')) || 0;
      const payload = toOwnedCard(selected, {
        quantity, condition, language, isReverse, unitPrice,
      });
      setWasNewToDex(isNewToDex);
      await addCards(user.uid, payload, cards);
      setStep('done');
    } catch (err: any) {
      // Antes isso falhava em silêncio e o botão parecia travado.
      setErroSalvar(
        err?.code === 'permission-denied'
          ? 'O Firestore recusou a gravação. Confira se as regras do arquivo firestore.rules foram publicadas no console do Firebase.'
          : `Não consegui salvar: ${err?.message ?? 'erro desconhecido'}`,
      );
    } finally {
      setSalvando(false);
    }
  }

  function restart() {
    setSelected(null);
    setMatches([]);
    setQuantity(1);
    setValor('');
    setErroSalvar(null);
    setStatus(null);
    setWasNewToDex(false);
    setStep('buscar');
  }

  // ── Passo 1: identificar a carta ─────────────────────────
  if (step === 'buscar') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Header
          title="Adicionar carta à coleção"
          hint="Escolha a coleção e digite o número do rodapé. A quantidade você escolhe depois."
        />

        <BuscaPorNumero
          onResultados={handleResults}
          onErro={(mensagem) => setStatus(mensagem)}
          colecoesUsadas={colecoesUsadas}
        />

        {status && <p className="text-center text-sm text-gold">{status}</p>}

        <div className="panel space-y-2 p-4">
          <p className="text-xs text-mist">Não sabe o número? Busque pelo nome dentro da coleção:</p>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarPorNome()}
              placeholder="Nome da carta na coleção escolhida"
              className="flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm outline-none focus:border-flame/60"
            />
            <button
              onClick={buscarPorNome}
              disabled={buscando}
              className="rounded-xl bg-ink-500 px-4 transition hover:bg-ink-400 disabled:opacity-40"
              aria-label="Buscar pelo nome"
            >
              <Search size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Passo 2: escolher entre variações do mesmo número ────
  if (step === 'picking') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Header title="Qual é a sua?" hint="Esse número tem mais de uma variação." />
        <ul className="grid grid-cols-2 gap-3">
          {matches.map((card) => (
            <li key={card.id}>
              <button
                onClick={() => { setSelected(card); setStep('confirm'); }}
                className="panel w-full overflow-hidden p-2 text-left transition hover:border-flame/60"
              >
                <img src={card.images.small} alt={card.name} className="mb-2 w-full rounded-lg" loading="lazy" />
                <p className="truncate font-display text-sm font-semibold">{card.name}</p>
                <p className="truncate text-[11px] text-mist">{card.set.name} · {card.number}</p>
              </button>
            </li>
          ))}
        </ul>
        <button onClick={restart} className="mx-auto flex items-center gap-1.5 text-sm text-mist hover:text-white">
          <RotateCcw size={14} /> Buscar outra
        </button>
      </div>
    );
  }

  // ── Passo 3: confirmar e definir quantidade ─────────────
  if (step === 'confirm' && selected) {
    const unit = Number(valor.replace(',', '.')) || 0;
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Header title="Carta identificada" hint="Confira os dados e diga quantas cópias você tem." />

        <DexStatus
          isNew={isNewToDex}
          hasNoDexEntry={hasNoDexEntry}
          pokedexId={pokedexId}
          pokemonName={dexEntry?.name ?? selected.name}
          slug={dexEntry?.slug}
          versions={ownedOfPokemon.length}
          copies={copiesOfPokemon}
          spriteStyle={settings.spriteStyle}
          animated={settings.animatedSprites}
        />

        <div className="panel flex gap-4 p-4">
          <img src={selected.images.small} alt={selected.name} className="w-24 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{selected.name}</p>
            <p className="text-sm text-mist">{selected.set.name}</p>
            <p className="text-sm text-mist">{selected.number}/{selected.set.printedTotal} · {selected.rarity ?? 'Comum'}</p>
            <p className="mt-2 text-[11px] text-mist">{selected.artist ? `Ilustração: ${selected.artist}` : ''}</p>
          </div>
        </div>

        <div className="panel space-y-4 p-4">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-mist">Quantas cópias você tem</p>
            <div className="flex items-center justify-center gap-5">
              <StepBtn onClick={() => setQuantity((q) => Math.max(1, q - 1))} label="Diminuir">
                <Minus size={20} />
              </StepBtn>
              <span className="w-16 text-center font-dex text-4xl font-bold">{quantity}</span>
              <StepBtn onClick={() => setQuantity((q) => q + 1)} label="Aumentar">
                <Plus size={20} />
              </StepBtn>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-mist">
              Valor unitário (opcional)
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-800 px-3">
              <span className="text-sm text-mist">R$</span>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ''))}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-mist">
              Deixe em branco se ainda não sabe. Dá para preencher depois na página do Pokémon.
            </p>
          </div>

          <Select label="Condição" value={condition} onChange={(v) => setCondition(v as CardCondition)} options={CONDITION_LABEL} />
          <Select label="Idioma" value={language} onChange={(v) => setLanguage(v as CardLanguage)} options={LANGUAGE_LABEL} />

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isReverse} onChange={(e) => setIsReverse(e.target.checked)} className="accent-flame" />
            Reverse holo
          </label>

          {unit > 0 && (
            <div className="flex items-center justify-between border-t border-white/[0.07] pt-3 text-sm">
              <span className="text-mist">Valor somado</span>
              <span className="font-display text-lg font-bold text-flame">{brl(unit * quantity)}</span>
            </div>
          )}
        </div>

        {erroSalvar && (
          <p className="rounded-xl border border-flame/40 bg-flame/10 p-3 text-sm text-flame">
            {erroSalvar}
          </p>
        )}

        <button
          onClick={confirmAdd}
          disabled={salvando}
          className="w-full rounded-xl bg-flame py-3 font-display font-bold shadow-glow transition hover:bg-flame-soft disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Adicionar à coleção'}
        </button>
        <button onClick={restart} className="mx-auto flex items-center gap-1.5 text-sm text-mist hover:text-white">
          <RotateCcw size={14} /> Buscar outra
        </button>
      </div>
    );
  }

  // ── Passo 4: adicionado ─────────────────────────────────
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center text-center">
      <div className="animate-dex-in">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-flame/15">
          <Check size={30} className="text-flame" />
        </div>
        <p className="font-display text-xl font-bold">
          {quantity} {quantity === 1 ? 'carta adicionada' : 'cartas adicionadas'}
        </p>
        <p className="mt-1 text-sm text-mist">{selected?.name} · {selected?.set.name}</p>

        {wasNewToDex && (
          <div className="mx-auto mt-5 flex max-w-xs items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-left">
            <PokemonSprite
              id={pokedexId}
              name={dexEntry?.name ?? ''}
              slug={dexEntry?.slug}
              size={52}
              style={settings.spriteStyle}
              animated={settings.animatedSprites}
              eager
            />
            <div>
              <p className="flex items-center gap-1.5 font-display text-sm font-bold text-gold">
                <Sparkles size={14} /> Novo na Pokédex
              </p>
              <p className="text-xs text-mist">
                {dexEntry?.name} saiu do cinza. Nº {dexNumber(pokedexId)} registrado.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button onClick={restart} className="rounded-xl bg-flame px-5 py-2.5 font-display font-bold">
            Adicionar outra
          </button>
          <button
            onClick={() => navigate(`/pokemon/${pokedexId}`)}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm"
          >
            Ver na Pokédex
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Diz, antes de gravar, o que esta carta significa para a Pokédex:
 * um Pokémon inédito, mais uma versão de um que já tem, ou uma carta
 * sem entrada na Pokédex (Treinador, Energia, itens).
 */
function DexStatus({
  isNew, hasNoDexEntry, pokedexId, pokemonName, slug, versions, copies, spriteStyle, animated,
}: {
  isNew: boolean;
  hasNoDexEntry: boolean;
  pokedexId: number;
  pokemonName: string;
  slug?: string;
  versions: number;
  copies: number;
  spriteStyle: SpriteStyle;
  animated: boolean;
}) {
  if (hasNoDexEntry) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-700 p-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink-500">
          <Info size={20} className="text-mist" />
        </div>
        <div>
          <p className="font-display text-sm font-bold">Carta sem entrada na Pokédex</p>
          <p className="text-xs text-mist">
            Treinador, Energia ou item. Entra na sua coleção e no valor total, mas não marca nenhum Pokémon.
          </p>
        </div>
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gold/45 bg-gold/10 p-3 shadow-[0_0_28px_-10px_rgba(255,203,5,.5)]">
        <PokemonSprite
          id={pokedexId}
          name={pokemonName}
          slug={slug}
          owned={false}
          size={52}
          style={spriteStyle}
          animated={animated}
          eager
        />
        <div>
          <p className="flex items-center gap-1.5 font-display text-sm font-bold text-gold">
            <Sparkles size={14} /> Pokémon não cadastrado
          </p>
          <p className="text-xs text-mist">
            Você ainda não tem nenhuma carta do {pokemonName}. Adicionar esta preenche o nº {dexNumber(pokedexId)} da Pokédex.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-700 p-3">
      <PokemonSprite
        id={pokedexId}
        name={pokemonName}
        slug={slug}
        size={52}
        style={spriteStyle}
        animated={animated}
        eager
      />
      <div>
        <p className="font-display text-sm font-bold">{pokemonName} já está na sua Pokédex</p>
        <p className="text-xs text-mist">
          Você tem {copies} {copies === 1 ? 'carta' : 'cartas'} dele em{' '}
          {versions} {versions === 1 ? 'versão' : 'versões'} diferentes.
        </p>
      </div>
    </div>
  );
}

function Header({ title, hint }: { title: string; hint: string }) {
  return (
    <header>
      <h1 className="font-display text-2xl font-extrabold">{title}</h1>
      <p className="text-sm text-mist">{hint}</p>
    </header>
  );
}

function StepBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-ink-600 transition hover:border-flame/60 active:scale-95"
    >
      {children}
    </button>
  );
}

function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: Record<string, string> }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-mist">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm outline-none focus:border-flame/60"
      >
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </label>
  );
}
