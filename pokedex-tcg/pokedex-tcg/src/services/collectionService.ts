// Camada de acesso ao Firestore. Nenhum componente importa firestore direto.
// Estrutura: users/{uid}/cards/{cardId}, users/{uid}/wishlist/{itemId},
//            users/{uid} (settings, favoritos de Pokémon)

import {
  collection, doc, deleteDoc, getDoc, onSnapshot, query, setDoc,
  updateDoc, writeBatch, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { OwnedCard, UserSettings, WishlistItem } from '@/types';

const cardsRef = (uid: string) => collection(db, 'users', uid, 'cards');
const wishlistRef = (uid: string) => collection(db, 'users', uid, 'wishlist');
const userRef = (uid: string) => doc(db, 'users', uid);

/** Assina a coleção inteira. Toda alteração chega em tempo real. */
export function subscribeCards(uid: string, cb: (cards: OwnedCard[]) => void) {
  const q = query(cardsRef(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OwnedCard));
  });
}

export function subscribeWishlist(uid: string, cb: (items: WishlistItem[]) => void) {
  return onSnapshot(wishlistRef(uid), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WishlistItem));
  });
}

/**
 * Adiciona cartas. Se o mesmo exemplar (mesmo tcgId + condição + idioma)
 * já existe, apenas soma a quantidade — não cria linha duplicada.
 */
export async function addCards(
  uid: string,
  card: Omit<OwnedCard, 'id'>,
  existing: OwnedCard[],
): Promise<string> {
  const match = existing.find(
    (c) =>
      c.tcgId === card.tcgId &&
      c.condition === card.condition &&
      c.language === card.language &&
      c.isReverse === card.isReverse &&
      c.isFirstEdition === card.isFirstEdition,
  );

  if (match) {
    await updateDoc(doc(cardsRef(uid), match.id), {
      quantity: match.quantity + card.quantity,
      unitPrice: card.unitPrice,
      priceUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return match.id;
  }

  const ref = doc(cardsRef(uid));
  await setDoc(ref, card);
  return ref.id;
}

export async function updateCard(uid: string, cardId: string, patch: Partial<OwnedCard>) {
  await updateDoc(doc(cardsRef(uid), cardId), { ...patch, updatedAt: Date.now() });
}

export async function removeCard(uid: string, cardId: string) {
  await deleteDoc(doc(cardsRef(uid), cardId));
}

export async function addToWishlist(uid: string, item: Omit<WishlistItem, 'id'>) {
  await setDoc(doc(wishlistRef(uid)), item);
}

export async function removeFromWishlist(uid: string, itemId: string) {
  await deleteDoc(doc(wishlistRef(uid), itemId));
}

export async function toggleFavoritePokemon(uid: string, pokedexId: number, favorites: number[]) {
  const next = favorites.includes(pokedexId)
    ? favorites.filter((i) => i !== pokedexId)
    : [...favorites, pokedexId];
  await setDoc(userRef(uid), { favoritePokemon: next }, { merge: true });
  return next;
}

export async function loadUserDoc(uid: string) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveSettings(uid: string, settings: Partial<UserSettings>) {
  await setDoc(userRef(uid), { settings, updatedAt: serverTimestamp() }, { merge: true });
}

/** Importação de backup: grava em lotes de 400 (limite do Firestore é 500). */
export async function importCards(uid: string, cards: Omit<OwnedCard, 'id'>[]) {
  for (let i = 0; i < cards.length; i += 400) {
    const batch = writeBatch(db);
    cards.slice(i, i + 400).forEach((c) => batch.set(doc(cardsRef(uid)), c));
    await batch.commit();
  }
}
