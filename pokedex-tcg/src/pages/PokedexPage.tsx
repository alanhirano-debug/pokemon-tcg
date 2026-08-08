import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { PokedexGrid } from '@/components/pokedex/PokedexGrid';
import { useCollection } from '@/contexts/CollectionContext';
import { usePokedexFilters } from '@/hooks/usePokedexFilters';
import { GENERATIONS } from '@/services/pokeapi';
import { TYPE_LABEL, pct } from '@/lib/format';
import type { PokemonType } from '@/types';

export function PokedexPage() {
  const { pokedex, holdings, favoritePokemon, settings, loadingDex, dexProgress } = useCollection();
  const { filters, filtered, counts, update, reset, activeCount } =
    usePokedexFilters(pokedex, holdings, favoritePokemon);
  const [panelOpen, setPanelOpen] = useState(false);

  if (loadingDex) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <div className="mx-auto mb-4 h-1.5 w-56 overflow-hidden rounded-full bg-ink-500">
            <div className="h-full bg-flame transition-all duration-300" style={{ width: `${dexProgress}%` }} />
          </div>
          <p className="font-display font-semibold">Montando a Pokédex nacional</p>
          <p className="text-sm text-mist">{dexProgress}% — só na primeira vez. Depois ela abre offline.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
          <input
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            placeholder="Buscar Pokémon ou número"
            className="w-full rounded-xl border border-white/10 bg-ink-700 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-flame/60"
          />
        </div>

        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-700 px-3.5 py-2.5 text-sm transition hover:border-white/25"
        >
          <SlidersHorizontal size={15} />
          Filtros
          {activeCount > 0 && (
            <span className="rounded-full bg-flame px-1.5 text-[10px] font-bold">{activeCount}</span>
          )}
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Chip active={filters.ownership === 'all'} onClick={() => update('ownership', 'all')}>
          Todos <b className="ml-1 font-dex text-[11px]">{counts.all}</b>
        </Chip>
        <Chip active={filters.ownership === 'owned'} onClick={() => update('ownership', 'owned')}>
          Obtidos <b className="ml-1 font-dex text-[11px]">{counts.owned}</b>
        </Chip>
        <Chip active={filters.ownership === 'missing'} onClick={() => update('ownership', 'missing')}>
          Faltando <b className="ml-1 font-dex text-[11px]">{counts.missing}</b>
        </Chip>
        <span className="ml-auto text-xs text-mist">
          {pct(counts.owned, counts.all)}% da Pokédex
        </span>
      </div>

      {panelOpen && (
        <div className="panel animate-dex-in space-y-4 p-4">
          <div>
            <Label>Região</Label>
            <div className="flex flex-wrap gap-2">
              <Chip active={filters.generation === 'all'} onClick={() => update('generation', 'all')}>
                Todas
              </Chip>
              {GENERATIONS.map(({ generation, region }) => (
                <Chip
                  key={generation}
                  active={filters.generation === generation}
                  onClick={() => update('generation', generation)}
                >
                  {region}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABEL) as PokemonType[]).map((t) => (
                <Chip
                  key={t}
                  active={filters.types.includes(t)}
                  onClick={() =>
                    update(
                      'types',
                      filters.types.includes(t)
                        ? filters.types.filter((x) => x !== t)
                        : [...filters.types, t],
                    )
                  }
                >
                  {TYPE_LABEL[t]}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-2">
              <Chip active={filters.legendary} onClick={() => update('legendary', !filters.legendary)}>Lendários</Chip>
              <Chip active={filters.mythical} onClick={() => update('mythical', !filters.mythical)}>Míticos</Chip>
              <Chip active={filters.baby} onClick={() => update('baby', !filters.baby)}>Baby</Chip>
              <Chip active={filters.favoritesOnly} onClick={() => update('favoritesOnly', !filters.favoritesOnly)}>Favoritos</Chip>
            </div>
          </div>

          {activeCount > 0 && (
            <button onClick={reset} className="flex items-center gap-1.5 text-xs text-mist hover:text-white">
              <X size={13} /> Limpar filtros
            </button>
          )}
        </div>
      )}

      <PokedexGrid
        entries={filtered}
        holdings={holdings}
        favorites={favoritePokemon}
        spriteStyle={settings.spriteStyle}
        animated={settings.animatedSprites}
        groupByRegion={filters.generation === 'all' && !filters.search}
      />
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1.5 text-xs transition',
        active
          ? 'border-flame bg-flame/15 font-semibold text-flame'
          : 'border-white/10 bg-ink-700 text-mist hover:border-white/25 hover:text-white',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] uppercase tracking-wider text-mist">{children}</div>;
}
