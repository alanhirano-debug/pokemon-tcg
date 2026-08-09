import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Sparkles } from 'lucide-react';
import { useCollection } from '@/contexts/CollectionContext';
import { exportCSV, exportPDF, exportXLSX } from '@/services/exportService';
import { NIVEL_DESTAQUE, ROTULOS_NIVEL, classificar, type NivelRaridade } from '@/lib/raridade';
import { brl } from '@/lib/format';
import type { OwnedCard } from '@/types';

type Modo = 'destaques' | 'colecao';

/**
 * O álbum. A Pokédex mostra o que falta; aqui é o oposto — o que você
 * conquistou, com as cartas especiais em primeiro plano e maiores.
 */
export function AlbumPage() {
  const { cards } = useCollection();
  const [modo, setModo] = useState<Modo>('destaques');
  const [nivelMinimo, setNivelMinimo] = useState<NivelRaridade | null>(null);
  const [termo, setTermo] = useState('');

  const enriquecidas = useMemo(
    () => cards.map((c) => ({ card: c, raridade: classificar(c.rarity, c.isHolo) })),
    [cards],
  );

  const filtradas = useMemo(() => {
    const busca = termo.trim().toLowerCase();
    return enriquecidas.filter(({ card, raridade }) => {
      if (nivelMinimo && raridade.nivel !== nivelMinimo) return false;
      if (!busca) return true;
      return [card.name, card.setName, card.number, card.rarity]
        .join(' ').toLowerCase().includes(busca);
    });
  }, [enriquecidas, nivelMinimo, termo]);

  const destaques = useMemo(
    () => filtradas
      .filter(({ raridade }) => raridade.nivel >= NIVEL_DESTAQUE)
      .sort((a, b) => b.raridade.nivel - a.raridade.nivel || b.card.createdAt - a.card.createdAt),
    [filtradas],
  );

  const restante = useMemo(
    () => filtradas
      .filter(({ raridade }) => raridade.nivel < NIVEL_DESTAQUE)
      .sort((a, b) => b.raridade.nivel - a.raridade.nivel || a.card.name.localeCompare(b.card.name)),
    [filtradas],
  );

  // Modo álbum físico: uma seção por coleção, na ordem do número impresso.
  const porColecao = useMemo(() => {
    const mapa = new Map<string, { nome: string; itens: typeof filtradas }>();
    for (const item of filtradas) {
      const atual = mapa.get(item.card.setId) ?? { nome: item.card.setName, itens: [] };
      atual.itens.push(item);
      mapa.set(item.card.setId, atual);
    }
    return [...mapa.entries()]
      .map(([id, grupo]) => ({
        id,
        nome: grupo.nome,
        itens: grupo.itens.sort(
          (a, b) => parseInt(a.card.number, 10) - parseInt(b.card.number, 10),
        ),
      }))
      .sort((a, b) => b.itens.length - a.itens.length);
  }, [filtradas]);

  const totalCopias = cards.reduce((s, c) => s + c.quantity, 0);
  const totalEspeciais = enriquecidas
    .filter(({ raridade }) => raridade.nivel >= NIVEL_DESTAQUE)
    .reduce((s, { card }) => s + card.quantity, 0);
  const valorTotal = cards.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  if (cards.length === 0) {
    return (
      <div className="panel mx-auto max-w-md px-6 py-16 text-center">
        <Sparkles size={30} className="mx-auto mb-3 text-mist" />
        <p className="font-display text-lg font-semibold">Seu álbum está vazio</p>
        <p className="mt-1 text-sm text-mist">
          Adicione sua primeira carta pela coleção e pelo número do rodapé.
        </p>
        <Link to="/adicionar" className="mt-5 inline-block rounded-xl bg-flame px-5 py-2.5 font-display font-bold">
          Adicionar carta
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Álbum</h1>
          <p className="text-sm text-mist">
            {totalCopias} cartas · {cards.length} únicas · {totalEspeciais} especiais
            {valorTotal > 0 && ` · ${brl(valorTotal)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCSV(cards)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs hover:border-white/25">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => exportXLSX(cards)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs hover:border-white/25">
            <Download size={13} /> Excel
          </button>
          <button onClick={() => exportPDF(cards)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs hover:border-white/25">
            <Download size={13} /> PDF
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-ink-700 p-1 sm:max-w-xs">
        {([['destaques', 'Destaques'], ['colecao', 'Por coleção']] as const).map(([valor, rotulo]) => (
          <button
            key={valor}
            onClick={() => setModo(valor)}
            className={[
              'rounded-xl py-2 font-display text-sm transition',
              modo === valor ? 'bg-flame font-bold' : 'text-mist hover:text-white',
            ].join(' ')}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar no álbum"
          className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-ink-700 px-3 py-2.5 text-sm outline-none focus:border-flame/60"
        />
        <button
          onClick={() => setNivelMinimo(null)}
          className={chipClasse(nivelMinimo === null)}
        >
          Todas
        </button>
        {ROTULOS_NIVEL.map(({ nivel, rotulo, cor }) => {
          const quantas = enriquecidas.filter((e) => e.raridade.nivel === nivel).length;
          if (quantas === 0) return null;
          return (
            <button
              key={nivel}
              onClick={() => setNivelMinimo(nivelMinimo === nivel ? null : nivel)}
              className={chipClasse(nivelMinimo === nivel)}
            >
              <span className={nivelMinimo === nivel ? '' : cor}>{rotulo}</span>
              <b className="ml-1 font-dex text-[11px]">{quantas}</b>
            </button>
          );
        })}
      </div>

      {modo === 'destaques' ? (
        <>
          {destaques.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                <Sparkles size={17} className="text-gold" /> Destaques
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {destaques.map((item) => (
                  <CartaAlbum key={item.card.id} {...item} grande />
                ))}
              </ul>
            </section>
          )}

          {restante.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold">
                {destaques.length > 0 ? 'Restante da coleção' : 'Suas cartas'}
              </h2>
              <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {restante.map((item) => (
                  <CartaAlbum key={item.card.id} {...item} />
                ))}
              </ul>
            </section>
          )}

          {filtradas.length === 0 && (
            <p className="panel px-6 py-12 text-center text-sm text-mist">
              Nenhuma carta com esse filtro.
            </p>
          )}
        </>
      ) : (
        <div className="space-y-7">
          {porColecao.map(({ id, nome, itens }) => (
            <section key={id}>
              <header className="mb-3 flex items-baseline gap-3">
                <h2 className="font-display text-lg font-bold">{nome}</h2>
                <span className="dex-num">{itens.length} cartas</span>
              </header>
              <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9">
                {itens.map((item) => (
                  <CartaAlbum key={item.card.id} {...item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function chipClasse(ativo: boolean) {
  return [
    'rounded-full border px-3 py-1.5 text-xs transition',
    ativo
      ? 'border-flame bg-flame/15 font-semibold text-flame'
      : 'border-white/10 bg-ink-700 hover:border-white/25',
  ].join(' ');
}

function CartaAlbum({
  card, raridade, grande = false,
}: {
  card: OwnedCard;
  raridade: ReturnType<typeof classificar>;
  grande?: boolean;
}) {
  return (
    <li>
      <Link
        to={`/pokemon/${card.pokedexId}`}
        className={[
          'group block overflow-hidden rounded-xl border bg-ink-700 p-1.5 transition duration-200 hover:-translate-y-1',
          raridade.moldura,
        ].join(' ')}
      >
        <div className="relative">
          <img src={card.imageLarge || card.imageSmall} alt={card.name} className="w-full rounded-lg" loading="lazy" />
          {card.quantity > 1 && (
            <span className="absolute right-1.5 top-1.5 rounded-full bg-ink-900/90 px-2 py-0.5 font-dex text-[10px] font-bold">
              ×{card.quantity}
            </span>
          )}
        </div>

        {grande ? (
          <div className="px-1 pb-0.5 pt-2">
            <p className="truncate font-display text-sm font-bold">{card.name}</p>
            <p className="truncate text-[11px] text-mist">{card.setName} · {card.number}</p>
            <p className={`text-[11px] font-semibold ${raridade.cor}`}>{card.rarity}</p>
            {card.unitPrice > 0 && (
              <p className="text-[11px] font-bold text-flame">{brl(card.unitPrice * card.quantity)}</p>
            )}
          </div>
        ) : (
          <p className="truncate px-1 pb-0.5 pt-1.5 text-[11px] font-medium">{card.name}</p>
        )}
      </Link>
    </li>
  );
}
