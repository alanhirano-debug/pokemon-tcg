import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { StatTile } from '@/components/ui/StatTile';
import { useCollection } from '@/contexts/CollectionContext';
import { useStats } from '@/hooks/useStats';
import { GENERATIONS } from '@/services/pokeapi';
import { TYPE_LABEL, brl, pct } from '@/lib/format';

export function StatsPage() {
  const { pokedex, cards, holdings } = useCollection();
  const stats = useStats(pokedex, cards, holdings);

  const byRegion = GENERATIONS.map(({ region, from, to }) => {
    const total = pokedex.filter((p) => p.id >= from && p.id <= to).length;
    const owned = pokedex.filter((p) => p.id >= from && p.id <= to && holdings.has(p.id)).length;
    return { região: region, obtidos: owned, faltando: total - owned };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Estatísticas</h1>
        <p className="text-sm text-mist">O retrato da sua coleção em números.</p>
      </header>

      <section className="panel flex flex-wrap items-center gap-8 p-6">
        <ProgressRing value={pct(stats.pokemonOwned, stats.totalPokemon)} label="da Pokédex" />
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Pokémon obtidos" value={stats.pokemonOwned} hint={`${pct(stats.pokemonOwned, stats.totalPokemon)}%`} accent />
          <StatTile label="Pokémon faltando" value={stats.pokemonMissing} />
          <StatTile label="Cartas totais" value={stats.totalCards} />
          <StatTile label="Cartas únicas" value={stats.uniqueCards} />
          <StatTile label="Duplicadas" value={stats.duplicates} />
          <StatTile label="Valor total" value={brl(stats.totalValue)} accent />
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 font-display font-bold">Progresso por região</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byRegion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a34" vertical={false} />
              <XAxis dataKey="região" stroke="#8b8b99" fontSize={11} />
              <YAxis stroke="#8b8b99" fontSize={11} />
              <Tooltip
                contentStyle={{ background: '#17171d', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12 }}
                cursor={{ fill: 'rgba(255,255,255,.04)' }}
              />
              <Bar dataKey="obtidos" stackId="a" fill="#ee1515" radius={[0, 0, 0, 0]} />
              <Bar dataKey="faltando" stackId="a" fill="#2a2a34" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="mb-3 font-display font-bold">Tipos mais colecionados</h2>
          {stats.typeBreakdown.length === 0 ? (
            <p className="text-sm text-mist">Adicione cartas para ver a divisão por tipo.</p>
          ) : (
            <ul className="space-y-2.5">
              {stats.typeBreakdown.slice(0, 8).map(({ type, count }) => (
                <li key={type} className="flex items-center gap-3 text-sm">
                  <span className="w-20 text-mist">{TYPE_LABEL[type]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-500">
                    <div
                      className={`h-full rounded-full bg-type-${type}`}
                      style={{ width: `${pct(count, stats.typeBreakdown[0].count)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-dex text-xs">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="mb-3 font-display font-bold">Mais versões colecionadas</h2>
          {stats.mostVersions.length === 0 ? (
            <p className="text-sm text-mist">Nenhuma carta registrada ainda.</p>
          ) : (
            <ol className="space-y-2">
              {stats.mostVersions.map((p, i) => (
                <li key={p.pokedexId} className="flex items-center gap-3 text-sm">
                  <span className="dex-num w-5">{i + 1}</span>
                  <span className="flex-1">{p.name}</span>
                  <span className="font-dex text-xs text-flame">{p.versions} versões</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
