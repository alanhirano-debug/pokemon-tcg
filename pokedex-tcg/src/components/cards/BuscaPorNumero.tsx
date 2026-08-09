import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { findBySetAndNumber, listSets, type TcgCard } from '@/services/tcgapi';
import type { TcgSet } from '@/types';

/** Última coleção usada, para o próximo cadastro já começar nela. */
const CHAVE_ULTIMA = 'pokedex-tcg:ultima-colecao';

interface Props {
  onResultados: (cards: TcgCard[], termo: string) => void;
  onErro: (mensagem: string) => void;
  /** IDs das coleções onde o usuário já tem cartas — aparecem primeiro. */
  colecoesUsadas: string[];
}

/**
 * Cadastro por coleção + número impresso.
 *
 * O par identifica a carta exata dentro da expansão. A coleção escolhida
 * fica memorizada: cadastrar um maço inteiro vira digitar só os números.
 */
export function BuscaPorNumero({ onResultados, onErro, colecoesUsadas }: Props) {
  const [sets, setSets] = useState<TcgSet[]>([]);
  const [filtro, setFiltro] = useState('');
  const [setEscolhido, setSetEscolhido] = useState<TcgSet | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [numero, setNumero] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    listSets()
      .then((lista) => {
        setSets(lista);
        const ultima = localStorage.getItem(CHAVE_ULTIMA);
        const anterior = ultima ? lista.find((s) => s.id === ultima) : null;
        if (anterior) setSetEscolhido(anterior);
      })
      .catch(() => onErro('Não consegui carregar a lista de coleções.'))
      .finally(() => setCarregando(false));
  }, [onErro]);

  function escolher(s: TcgSet) {
    setSetEscolhido(s);
    setTrocando(false);
    setFiltro('');
    localStorage.setItem(CHAVE_ULTIMA, s.id);
  }

  const { minhas, outras } = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    const combina = (s: TcgSet) =>
      !termo || `${s.name} ${s.series} ${s.id} ${s.ptcgoCode ?? ''}`.toLowerCase().includes(termo);

    const usadas = new Set(colecoesUsadas);
    const filtradas = sets.filter(combina);

    return {
      minhas: filtradas.filter((s) => usadas.has(s.id)),
      outras: filtradas.filter((s) => !usadas.has(s.id)).slice(0, 40),
    };
  }, [sets, filtro, colecoesUsadas]);

  async function buscar() {
    if (!setEscolhido || !numero.trim()) return;
    setBuscando(true);
    try {
      const cards = await findBySetAndNumber(setEscolhido.id, numero);
      if (cards.length === 0) {
        onErro(`Nenhuma carta ${numero} em ${setEscolhido.name}. Confira o número antes da barra.`);
        return;
      }
      onResultados(cards, `${setEscolhido.name} ${numero}`);
      setNumero('');
    } catch (err: any) {
      onErro(err?.message ?? 'A busca falhou.');
    } finally {
      setBuscando(false);
    }
  }

  if (carregando) {
    return <p className="py-8 text-center text-sm text-mist">Carregando coleções…</p>;
  }

  const mostrandoLista = !setEscolhido || trocando;

  if (mostrandoLista) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Sigla do rodapé (MEG) ou nome da coleção"
            className="w-full rounded-xl border border-white/10 bg-ink-700 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-flame/60"
            autoFocus
          />
        </div>

        <div className="max-h-[430px] space-y-4 overflow-y-auto pr-1">
          {minhas.length > 0 && (
            <Grupo titulo="Minhas coleções" sets={minhas} onEscolher={escolher} />
          )}
          {outras.length > 0 && (
            <Grupo
              titulo={minhas.length > 0 ? 'Outras coleções' : 'Todas as coleções'}
              sets={outras}
              onEscolher={escolher}
            />
          )}
          {minhas.length === 0 && outras.length === 0 && (
            <p className="py-8 text-center text-sm text-mist">Nenhuma coleção com esse nome.</p>
          )}
        </div>

        {setEscolhido && (
          <button
            onClick={() => { setTrocando(false); setFiltro(''); }}
            className="w-full text-center text-xs text-mist hover:text-white"
          >
            Cancelar e voltar para {setEscolhido.name}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setTrocando(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-flame/50 bg-flame/10 p-2.5 text-left"
      >
        <img src={setEscolhido.logo} alt="" className="h-8 w-14 shrink-0 object-contain" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{setEscolhido.name}</span>
          <span className="block text-[11px] text-mist">Toque para trocar de coleção</span>
        </span>
      </button>

      <div>
        <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-mist">
          Número impresso no rodapé
        </label>
        <div className="flex gap-2">
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            inputMode="numeric"
            placeholder="001"
            className="flex-1 rounded-xl border border-white/10 bg-ink-700 px-3 py-3 text-center font-dex text-2xl outline-none focus:border-flame/60"
            autoFocus
          />
          <button
            onClick={buscar}
            disabled={buscando || !numero.trim()}
            className="rounded-xl bg-flame px-5 font-display font-bold transition hover:bg-flame-soft disabled:opacity-40"
          >
            {buscando ? '…' : 'Buscar'}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-mist">
          Só a parte antes da barra. Em <b>001/132</b>, digite <b>001</b>.
        </p>
      </div>
    </div>
  );
}

function Grupo({
  titulo, sets, onEscolher,
}: { titulo: string; sets: TcgSet[]; onEscolher: (s: TcgSet) => void }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-mist">{titulo}</h3>
      <ul className="space-y-1.5">
        {sets.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onEscolher(s)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-ink-700 p-2.5 text-left transition hover:border-flame/60"
            >
              <img src={s.logo} alt="" className="h-8 w-14 shrink-0 object-contain" loading="lazy" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.name}</span>
                <span className="block truncate text-[11px] text-mist">
                  {s.ptcgoCode ? `${s.ptcgoCode} · ` : ''}{s.printedTotal} cartas · {s.releaseDate}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
