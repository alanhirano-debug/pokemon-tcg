import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3, Camera, Heart, LayoutGrid, Library, LogOut, Settings, Star,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const NAV = [
  { to: '/', label: 'Pokédex', icon: LayoutGrid, end: true },
  { to: '/colecoes', label: 'Coleções', icon: Library },
  { to: '/cartas', label: 'Minhas cartas', icon: Star },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      {/* Navegação lateral no desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-white/[0.06] bg-ink-900/70 px-3 py-5 lg:flex">
        <div className="mb-7 flex items-center gap-2 px-2">
          <PokeballMark />
          <div>
            <div className="font-display text-base font-extrabold leading-none">Pokédex TCG</div>
            <div className="text-[10px] text-mist">Complete pela coleção</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  isActive ? 'bg-flame/15 font-semibold text-flame' : 'text-mist hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <NavLink
          to="/adicionar"
          className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-flame px-3 py-2.5 font-display text-sm font-bold shadow-glow transition hover:bg-flame-soft"
        >
          <Camera size={17} /> Escanear carta
        </NavLink>

        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-mist transition hover:text-white"
        >
          <LogOut size={14} />
          <span className="truncate">{user?.displayName ?? user?.email}</span>
        </button>
      </aside>

      <main className="min-w-0 px-4 pb-32 pt-5 lg:px-7 lg:pb-8">
        <Outlet />
      </main>

      {/* Barra inferior no celular */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-white/[0.07] bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
          <TabLink key={to} to={to} label={label} Icon={Icon} end={end} />
        ))}

        <NavLink
          to="/adicionar"
          className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-flame shadow-glow"
          aria-label="Escanear carta"
        >
          <Camera size={24} />
        </NavLink>

        {NAV.slice(4, 6).map(({ to, label, icon: Icon }) => (
          <TabLink key={to} to={to} label={label} Icon={Icon} />
        ))}
      </nav>
    </div>
  );
}

function TabLink({ to, label, Icon, end }: { to: string; label: string; Icon: any; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex w-16 flex-col items-center gap-1 py-3 text-[10px] ${isActive ? 'text-flame' : 'text-mist'}`
      }
    >
      <Icon size={19} />
      {label}
    </NavLink>
  );
}

export function PokeballMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#f5f5f7" />
      <path d="M1 16a15 15 0 0 1 30 0Z" fill="#ee1515" />
      <rect x="1" y="14.2" width="30" height="3.6" fill="#0b0b0e" />
      <circle cx="16" cy="16" r="5.4" fill="#0b0b0e" />
      <circle cx="16" cy="16" r="3.2" fill="#f5f5f7" />
    </svg>
  );
}
