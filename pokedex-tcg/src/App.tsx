import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, PokeballMark } from '@/components/layout/AppShell';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CollectionProvider } from '@/contexts/CollectionContext';
import { LoginPage } from '@/pages/LoginPage';
import { PokedexPage } from '@/pages/PokedexPage';

// Cada tela vira um pedaço separado, baixado só quando você entra nela.
// Sem isto, abrir a Pokédex trazia junto gráficos, planilhas e PDF.
const AddCardPage = lazy(() => import('@/pages/AddCardPage').then((m) => ({ default: m.AddCardPage })));
const AlbumPage = lazy(() => import('@/pages/AlbumPage').then((m) => ({ default: m.AlbumPage })));
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage })));
const PokemonDetailPage = lazy(() => import('@/pages/PokemonDetailPage').then((m) => ({ default: m.PokemonDetailPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const StatsPage = lazy(() => import('@/pages/StatsPage').then((m) => ({ default: m.StatsPage })));
const WishlistPage = lazy(() => import('@/pages/WishlistPage').then((m) => ({ default: m.WishlistPage })));

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <PokeballMark size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <CollectionProvider>
      <Suspense fallback={<div className="grid min-h-[50vh] place-items-center text-sm text-mist">Carregando…</div>}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<PokedexPage />} />
          <Route path="pokemon/:id" element={<PokemonDetailPage />} />
          <Route path="colecoes" element={<CollectionsPage />} />
          <Route path="album" element={<AlbumPage />} />
          <Route path="cartas" element={<Navigate to="/album" replace />} />
          <Route path="adicionar" element={<AddCardPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="estatisticas" element={<StatsPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </Suspense>
    </CollectionProvider>
  );
}
