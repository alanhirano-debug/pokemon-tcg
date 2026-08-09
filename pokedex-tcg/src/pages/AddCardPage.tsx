import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, ImagePlus, Info, Minus, Plus, RotateCcw, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '@/contexts/CollectionContext';
import { PokemonSprite } from '@/components/pokedex/PokemonSprite';
import { addCards } from '@/services/collectionService';
import { findByNameAndNumber, searchCards, toOwnedCard, type TcgCard } from '@/services/tcgapi';
import { FULL_FRAME, readCardText, readWholeCard, type Rect } from '@/services/cardRecognition';
import { resolverNome } from '@/services/nameMatch';
import { CONDITION_LABEL, LANGUAGE_LABEL, brl, dexNumber } from '@/lib/format';
import type { CardCondition, CardLanguage, SpriteStyle } from '@/types';

type Step = 'scan' | 'picking' | 'confirm' | 'done';

export function AddCardPage() {
  const { user } = useAuth();
  const { cards, pokedex, settings, fx } = useCollection();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>('scan');
  const [status, setStatus] = useState<string | null>(null);
  const [matches, setMatches] = useState<TcgCard[]>([]);
  const [selected, setSelected] = useState<TcgCard | null>(null);
  const [manual, setManual] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Texto cru do OCR — só aparece quando a leitura falha, para diagnóstico. */
  const [ocrDebug, setOcrDebug] = useState<string | null>(null);

  // Dados do exemplar — escolhidos uma vez, valem para todas as cópias
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<CardCondition>('NM');
  const [language, setLanguage] = useState<CardLanguage>('PT');
  const [isReverse, setIsReverse] = useState(false);

  // Guarda o status ANTES de gravar — depois do addCards a assinatura do
  // Firestore atualiza `cards` e o Pokémon deixaria de parecer inédito.
  const [wasNewToDex, setWasNewToDex] = useState(false);

  useEffect(() => {
    if (step !== 'scan') return;
    let cancelled = false;

    async function abrirCamera() {
      // Sem HTTPS o navegador nem expõe a API — e o erro que isso gerava
      // antes era um crash silencioso, com a tela em branco.
      if (!window.isSecureContext) {
        setStatus('A câmera exige HTTPS. Abra o app pelo endereço publicado (Netlify/Vercel) ou por localhost — pelo IP da rede local o navegador bloqueia.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('Este navegador não expõe a câmera. No iPhone, use o Safari; no Android, o Chrome.');
        return;
      }

      // Primeiro a traseira; se o aparelho recusar a restrição, qualquer uma.
      const tentativas: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } } },
        { video: { facingMode: 'environment' } },
        { video: true },
      ];

      for (const constraints of tentativas) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
          }
          setCameraReady(true);
          setStatus(null);
          return;
        } catch (err: any) {
          if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
            setStatus('Permissão de câmera negada. Toque no cadeado ao lado do endereço e libere a câmera para este site.');
            return;
          }
          if (err?.name === 'NotFoundError') {
            setStatus('Nenhuma câmera encontrada neste aparelho.');
            return;
          }
          if (err?.name === 'NotReadableError') {
            setStatus('A câmera está ocupada por outro app. Feche-o e tente de novo.');
            return;
          }
          // OverconstrainedError e afins: cai para a próxima tentativa.
        }
      }

      setStatus('Não consegui abrir a câmera. Use a foto da galeria abaixo — funciona igual.');
    }

    abrirCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraReady(false);
    };
  }, [step]);

  /**
   * Converte a moldura que o usuário vê em coordenadas do frame real.
   * O vídeo aparece com object-cover, então parte dele fica fora da tela —
   * medir os dois elementos é o único jeito de recortar exatamente o que
   * está dentro da moldura.
   */
  function molduraNoFrame(video: HTMLVideoElement): Rect {
    const guide = guideRef.current;
    if (!guide) return FULL_FRAME;

    const vBox = video.getBoundingClientRect();
    const gBox = guide.getBoundingClientRect();
    const escala = Math.max(vBox.width / video.videoWidth, vBox.height / video.videoHeight);

    const sobraX = (video.videoWidth * escala - vBox.width) / 2;
    const sobraY = (video.videoHeight * escala - vBox.height) / 2;

    return {
      x: (gBox.left - vBox.left + sobraX) / escala / video.videoWidth,
      y: (gBox.top - vBox.top + sobraY) / escala / video.videoHeight,
      w: gBox.width / escala / video.videoWidth,
      h: gBox.height / escala / video.videoHeight,
    };
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setStatus('A câmera ainda não está pronta. Aguarde um instante.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    await reconhecer(canvas, molduraNoFrame(video));
  }

  /** Foto da galeria ou da câmera nativa — caminho alternativo completo. */
  async function usarFoto(file: File) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();

    await reconhecer(canvas, FULL_FRAME);
  }

  async function reconhecer(canvas: HTMLCanvasElement, area: Rect) {
    setBusy(true);
    setOcrDebug(null);
    setStatus('Lendo a carta…');

    try {
      // Primeira tentativa: as faixas dentro da moldura.
      let leitura = await readCardText(canvas, area);
      let nome = leitura.name ? resolverNome(leitura.name, pokedex) : null;

      // O texto lido não parece nenhum Pokémon conhecido. Isso acontece
      // quando a carta não preenche a moldura e a faixa cai no fundo da
      // foto — então vale reler a imagem inteira antes de desistir.
      if (!nome) {
        const completa = await readWholeCard(canvas);
        const alternativa = completa.name ? resolverNome(completa.name, pokedex) : null;
        if (alternativa) {
          leitura = completa;
          nome = alternativa;
        }
      }

      if (!nome) {
        setStatus('Não reconheci nenhum Pokémon na imagem. Encoste mais, deixando a carta preencher a moldura inteira.');
        setOcrDebug(leitura.raw);
        return;
      }

      // Confiança baixa: avisa qual leitura foi usada, para você conferir.
      if (nome.confianca < 0.9) {
        setStatus(`Li como "${nome.pokemon}". Se não for, use a busca por nome.`);
      } else {
        setStatus(null);
      }

      let resultados = await findByNameAndNumber(nome.consulta, leitura.number ?? undefined);
      if (resultados.length === 0 && leitura.number) {
        resultados = await findByNameAndNumber(nome.consulta);
      }
      if (resultados.length === 0 && nome.consulta !== nome.pokemon) {
        resultados = await findByNameAndNumber(nome.pokemon);
      }

      handleResults(resultados, nome.pokemon);
      if (resultados.length === 0) setOcrDebug(leitura.raw);
    } catch (err: any) {
      setStatus(err?.message ?? 'A leitura falhou. Tente a busca por nome.');
    } finally {
      setBusy(false);
    }
  }

  async function searchManually() {
    if (!manual.trim()) return;
    setOcrDebug(null);
    setStatus('Buscando…');
    try {
      const results = await searchCards(`name:"${manual.trim()}*"`);
      setStatus(null);
      handleResults(results, manual);
    } catch {
      setStatus('A busca falhou. Verifique sua conexão.');
    }
  }

  function handleResults(results: TcgCard[], term: string) {
    if (results.length === 0) {
      setStatus(`Nenhuma carta encontrada para "${term}".`);
      return;
    }
    if (results.length === 1) {
      setSelected(results[0]);
      setStep('confirm');
      return;
    }
    setMatches(results);
    setStep('picking');
  }

  // Situação do Pokémon desta carta na Pokédex do usuário.
  const pokedexId = selected?.nationalPokedexNumbers?.[0] ?? 0;
  const dexEntry = pokedex.find((p) => p.id === pokedexId);
  const ownedOfPokemon = pokedexId > 0 ? cards.filter((c) => c.pokedexId === pokedexId) : [];
  const copiesOfPokemon = ownedOfPokemon.reduce((sum, c) => sum + c.quantity, 0);
  const isNewToDex = pokedexId > 0 && ownedOfPokemon.length === 0;
  const hasNoDexEntry = Boolean(selected) && pokedexId === 0;

  async function confirmAdd() {
    if (!user || !selected) return;
    const payload = toOwnedCard(selected, { quantity, condition, language, isReverse }, fx);
    setWasNewToDex(isNewToDex);
    await addCards(user.uid, payload, cards);
    setStep('done');
  }

  function restart() {
    setSelected(null);
    setMatches([]);
    setQuantity(1);
    setStatus(null);
    setOcrDebug(null);
    setWasNewToDex(false);
    setStep('scan');
  }

  // ── Passo 1: câmera ───────────────────────────────────────
  if (step === 'scan') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Header title="Escanear carta" hint="Encaixe a carta na moldura. Uma leitura só — a quantidade você escolhe depois." />

        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

          {/* A moldura tem a proporção real de uma carta (63x88mm). O recorte
              do OCR é medido a partir dela, então o que você encaixa aqui é
              exatamente o que é lido. */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div
              ref={guideRef}
              className="relative aspect-[63/88] h-[86%] rounded-xl border-2 border-flame/70"
            >
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-flame/70 animate-scan-line" />
            </div>
          </div>

          {!cameraReady && (
            <div className="absolute inset-0 grid place-items-center bg-ink-900/85 px-6 text-center">
              <p className="text-sm text-mist">
                {status ?? 'Abrindo a câmera…'}
              </p>
            </div>
          )}
        </div>

        {cameraReady && status && <p className="text-center text-sm text-gold">{status}</p>}

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => fileRef.current?.click()}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-ink-600 transition hover:border-white/25"
            aria-label="Usar foto da galeria"
          >
            <ImagePlus size={20} />
          </button>

          <button
            onClick={capture}
            disabled={!cameraReady || busy}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-flame shadow-glow transition hover:bg-flame-soft disabled:opacity-40"
            aria-label="Capturar carta"
          >
            <Camera size={26} />
          </button>

          <div className="h-12 w-12" aria-hidden />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) usarFoto(file);
            e.target.value = '';
          }}
        />

        <p className="text-center text-xs text-mist">
          Sem câmera? O botão da esquerda aceita uma foto da carta.
        </p>

        {ocrDebug && (
          <details className="panel p-3 text-xs">
            <summary className="cursor-pointer text-mist">O que o app leu na carta</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-dex text-[10px] text-mist">
              {ocrDebug}
            </pre>
          </details>
        )}

        <div className="panel space-y-2 p-4">
          <p className="text-xs text-mist">Prefere digitar?</p>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchManually()}
              placeholder="Nome da carta, ex. Charizard ex"
              className="flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm outline-none focus:border-flame/60"
            />
            <button onClick={searchManually} className="rounded-xl bg-ink-500 px-4 transition hover:bg-ink-400" aria-label="Buscar">
              <Search size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Passo 2: escolher entre versões parecidas ─────────────
  if (step === 'picking') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Header title="Qual é a sua?" hint="Encontrei mais de uma versão dessa carta." />
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
          <RotateCcw size={14} /> Escanear de novo
        </button>
      </div>
    );
  }

  // ── Passo 3: confirmar e definir quantidade ───────────────
  if (step === 'confirm' && selected) {
    const unit = toOwnedCard(selected, {}, fx).unitPrice;
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
            <p className="mt-2 font-display font-bold text-flame">{brl(unit)}</p>
            <p className="text-[11px] text-mist">
              {fx.live
                ? `convertido pelo dólar de hoje (R$ ${fx.usd.toFixed(2)})`
                : `dólar de referência (R$ ${fx.usd.toFixed(2)})`}
            </p>
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

          <Select label="Condição" value={condition} onChange={(v) => setCondition(v as CardCondition)} options={CONDITION_LABEL} />
          <Select label="Idioma" value={language} onChange={(v) => setLanguage(v as CardLanguage)} options={LANGUAGE_LABEL} />

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isReverse} onChange={(e) => setIsReverse(e.target.checked)} className="accent-flame" />
            Reverse holo
          </label>

          <div className="flex items-center justify-between border-t border-white/[0.07] pt-3 text-sm">
            <span className="text-mist">Valor somado</span>
            <span className="font-display text-lg font-bold text-flame">{brl(unit * quantity)}</span>
          </div>
        </div>

        <button
          onClick={confirmAdd}
          className="w-full rounded-xl bg-flame py-3 font-display font-bold shadow-glow transition hover:bg-flame-soft"
        >
          Adicionar à coleção
        </button>
        <button onClick={restart} className="mx-auto flex items-center gap-1.5 text-sm text-mist hover:text-white">
          <RotateCcw size={14} /> Escanear novamente
        </button>
      </div>
    );
  }

  // ── Passo 4: adicionado ──────────────────────────────────
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
            Escanear outra
          </button>
          <button
            onClick={() => navigate(`/pokemon/${selected?.nationalPokedexNumbers?.[0] ?? ''}`)}
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
