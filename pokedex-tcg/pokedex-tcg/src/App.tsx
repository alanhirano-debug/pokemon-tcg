import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, PokeballMark } from '@/components/layout/AppShell';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CollectionProvider } from '@/contexts/CollectionContext';
import { AddCardPage } from '@/pages/AddCardPage';
import { CollectionsPage } from '@/pages/CollectionsPage';
import { LoginPage } from '@/pages/LoginPage';
import { MyCardsPage } from '@/pages/MyCardsPage';
import { PokedexPage } from '@/pages/PokedexPage';
import { PokemonDetailPage } from '@/pages/PokemonDetailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { StatsPage } from '@/pages/StatsPage';
import { WishlistPage } from '@/pages/WishlistPage';

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
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<PokedexPage />} />
          <Route path="pokemon/:id" element={<PokemonDetailPage />} />
          <Route path="colecoes" element={<CollectionsPage />} />
          <Route path="cartas" element={<MyCardsPage />} />
          <Route path="adicionar" element={<AddCardPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="estatisticas" element={<StatsPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CollectionProvider>
  );
}
