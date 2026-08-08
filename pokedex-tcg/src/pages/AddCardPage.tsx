import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, Minus, Plus, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '@/contexts/CollectionContext';
import { addCards } from '@/services/collectionService';
import { findByNameAndNumber, searchCards, toOwnedCard, type TcgCard } from '@/services/tcgapi';
import { readCardText } from '@/services/cardRecognition';
import { CONDITION_LABEL, LANGUAGE_LABEL, brl } from '@/lib/format';
import type { CardCondition, CardLanguage } from '@/types';

type Step = 'scan' | 'picking' | 'confirm' | 'done';

export function AddCardPage() {
  const { user } = useAuth();
  const { cards } = useCollection();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>('scan');
  const [status, setStatus] = useState<string | null>(null);
  const [matches, setMatches] = useState<TcgCard[]>([]);
  const [selected, setSelected] = useState<TcgCard | null>(null);
  const [manual, setManual] = useState('');

  // Dados do exemplar — escolhidos uma vez, valem para todas as cópias
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<CardCondition>('NM');
  const [language, setLanguage] = useState<CardLanguage>('PT');
  const [isReverse, setIsReverse] = useState(false);

  useEffect(() => {
    if (step !== 'scan') return;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setStatus('Não consegui abrir a câmera. Libere o acesso nas permissões do navegador ou busque a carta pelo nome.'));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [step]);

  async function capture() {
    const video = videoRef.current;
    if (!video) return;

    setStatus('Lendo a carta…');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    try {
      const { name, number } = await readCardText(canvas);
      if (!name) {
        setStatus('Não deu para ler o nome. Aproxime a carta, melhore a luz ou busque pelo nome.');
        return;
      }
      setStatus(null);
      const results = await findByNameAndNumber(name, number);
      handleResults(results, name);
    } catch {
      setStatus('A leitura falhou. Tente de novo ou busque pelo nome.');
    }
  }

  async function searchManually() {
    if (!manual.trim()) return;
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

  async function confirmAdd() {
    if (!user || !selected) return;
    const payload = toOwnedCard(selected, { quantity, condition, language, isReverse });
    await addCards(user.uid, payload, cards);
    setStep('done');
  }

  function restart() {
    setSelected(null);
    setMatches([]);
    setQuantity(1);
    setStatus(null);
    setStep('scan');
  }

  // ── Passo 1: câmera ───────────────────────────────────────
  if (step === 'scan') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Header title="Escanear carta" hint="Encaixe a carta na moldura. Uma leitura só — a quantidade você escolhe depois." />

        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-[68%] w-[74%] rounded-xl border-2 border-flame/70">
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-flame/70 animate-scan-line" />
            </div>
          </div>
        </div>

        {status && <p className="text-center text-sm text-gold">{status}</p>}

        <button
          onClick={capture}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-flame shadow-glow transition hover:bg-flame-soft"
          aria-label="Capturar carta"
        >
          <Camera size={26} />
        </button>

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
    const unit = toOwnedCard(selected).unitPrice;
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Header title="Carta identificada" hint="Confira os dados e diga quantas cópias você tem." />

        <div className="panel flex gap-4 p-4">
          <img src={selected.images.small} alt={selected.name} className="w-24 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{selected.name}</p>
            <p className="text-sm text-mist">{selected.set.name}</p>
            <p className="text-sm text-mist">{selected.number}/{selected.set.printedTotal} · {selected.rarity ?? 'Comum'}</p>
            <p className="mt-2 font-display font-bold text-flame">{brl(unit)}</p>
            <p className="text-[11px] text-mist">preço atualizado agora</p>
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
