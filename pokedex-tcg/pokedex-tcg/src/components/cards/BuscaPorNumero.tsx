import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { findBySetAndNumber, listSets, type TcgCard } from '@/services/tcgapi';
import type { TcgSet } from '@/types';

/**
 * Cadastro por coleção + número impresso.
 *
 * É o caminho confiável: o número no rodapé da carta identifica ela sem
 * ambiguidade dentro da coleção. Nada de foto, luz ou reconhecimento —
 * por isso funciona igual às 3h da manhã com a luz do abajur.
 */
export function BuscaPorNumero({
  onResultados,
  onErro,
}: {
  onResultados: (cards: TcgCard[], termo: string) => void;
  onErro: (mensagem: string) => void;
}) {
  const [sets, setSets] = useState<TcgSet[]>([]);
  const [filtro, setFiltro] = useState('');
  const [setEscolhido, setSetEscolhido] = useState<TcgSet | null>(null);
  const [numero, setNumero] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    listSets()
      .then(setSets)
      .catch(() => onErro('Não consegui carregar a lista de coleções.'))
      .finally(() => setCarregando(false));
  }, [onErro]);

  const visiveis = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    const lista = termo
      ? sets.filter((s) =>
          `${s.name} ${s.series} ${s.id} ${s.ptcgoCode ?? ''}`.toLowerCase().includes(termo),
        )
      : sets;
    return lista.slice(0, 40);
  }, [sets, filtro]);

  async function buscar() {
    if (!setEscolhido || !numero.trim()) return;
    setBuscando(true);
    try {
      const cards = await findBySetAndNumber(setEscolhido.id, numero);
      if (cards.length === 0) {
        onErro(
          `Nenhuma carta ${numero} em ${setEscolhido.name}. Confira o número no rodapé — é o primeiro, antes da barra.`,
        );
        return;
      }
      onResultados(cards, `${setEscolhido.name} ${numero}`);
    } catch (err: any) {
      onErro(err?.message ?? 'A busca falhou.');
    } finally {
      setBuscando(false);
    }
  }

  if (carregando) {
    return <p className="py-8 text-center text-sm text-mist">Carregando coleções…</p>;
  }

  return (
    <div className="space-y-4">
      {!setEscolhido ? (
        <>
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

          <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
            {visiveis.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSetEscolhido(s)}
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
            {visiveis.length === 0 && (
              <li className="py-8 text-center text-sm text-mist">
                Nenhuma coleção com esse nome.
              </li>
            )}
          </ul>
        </>
      ) : (
        <>
          <button
            onClick={() => setSetEscolhido(null)}
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
        </>
      )}
    </div>
  );
}
