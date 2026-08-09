import { useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '@/contexts/CollectionContext';
import { importCards, saveSettings } from '@/services/collectionService';
import { exportBackup, readBackup } from '@/services/exportService';
import { clearPokedexCache } from '@/services/pokeapi';
import { SPRITE_STYLE_OPTIONS } from '@/services/sprites';
import { VERSAO } from '@/lib/versao';
import { PokemonSprite } from '@/components/pokedex/PokemonSprite';
import type { SpriteStyle, UserSettings } from '@/types';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { settings, setSettings, cards } = useCollection();
  const fileRef = useRef<HTMLInputElement>(null);

  function patch(next: Partial<UserSettings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    if (user) saveSettings(user.uid, merged);
  }

  async function handleImport(file: File) {
    if (!user) return;
    const imported = await readBackup(file);
    await importCards(user.uid, imported);
  }

  return (
    <div className="max-w-2xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Configurações</h1>
        <p className="text-sm text-mist">{user?.email}</p>
      </header>

      <Section title="Sprites" hint="A Pokédex usa apenas sprites 2D — nenhum modelo 3D.">
        <div className="grid gap-3 sm:grid-cols-2">
          {SPRITE_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => patch({ spriteStyle: opt.value as SpriteStyle })}
              className={[
                'flex items-center gap-3 rounded-xl border p-3 text-left transition',
                settings.spriteStyle === opt.value
                  ? 'border-flame bg-flame/10'
                  : 'border-white/10 hover:border-white/25',
              ].join(' ')}
            >
              <PokemonSprite id={6} name="Charizard" slug="charizard" size={52} style={opt.value} animated={settings.animatedSprites} />
              <div>
                <p className="font-display text-sm font-bold">{opt.label}</p>
                <p className="text-[11px] text-mist">{opt.hint}</p>
              </div>
            </button>
          ))}
        </div>

        <Toggle
          label="Sprites animados"
          hint="Usa os GIFs 2D quando existirem. Desligue para economizar dados."
          checked={settings.animatedSprites}
          onChange={(v) => patch({ animatedSprites: v })}
        />
      </Section>

      <Section title="Aparência">
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => patch({ theme: t })}
              className={[
                'flex-1 rounded-xl border py-2.5 text-sm transition',
                settings.theme === t ? 'border-flame bg-flame/10 font-semibold text-flame' : 'border-white/10 hover:border-white/25',
              ].join(' ')}
            >
              {t === 'dark' ? 'Tema escuro' : 'Tema claro'}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Backup" hint={`${cards.length} cartas registradas.`}>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportBackup(cards)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:border-white/25">
            Exportar banco
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:border-white/25">
            Importar banco
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
          />
          <button
            onClick={() => clearPokedexCache().then(() => location.reload())}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:border-white/25"
          >
            Recarregar Pokédex
          </button>
        </div>
      </Section>

      <button onClick={logout} className="rounded-xl border border-flame/40 px-4 py-2.5 text-sm text-flame hover:bg-flame/10">
        Sair da conta
      </button>

      <p className="pt-2 text-center text-xs text-mist">
        Pokédex TCG · versão <b className="font-dex">{VERSAO}</b>
      </p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-3 p-5">
      <div>
        <h2 className="font-display font-bold">{title}</h2>
        {hint && <p className="text-xs text-mist">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  label, hint, checked, onChange,
}: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 p-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[11px] text-mist">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-flame" />
    </label>
  );
}
