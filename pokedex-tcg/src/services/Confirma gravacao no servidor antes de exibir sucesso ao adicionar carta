// Camada de acesso ao Firestore. Nenhum componente importa firestore direto.
// Estrutura: users/{uid}/cards/{cardId}, users/{uid}/wishlist/{itemId},
//            users/{uid} (settings, favoritos de Pokémon)

import {
  collection, doc, deleteDoc, getDoc, getDocFromServer, onSnapshot, query, setDoc,
  updateDoc, writeBatch, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { OwnedCard, UserSettings, WishlistItem } from '@/types';

/**
 * O Firestore REJEITA campos com valor undefined — não ignora, lança erro.
 * Cartas sem artista, HP ou tipo (Treinador, Energia, dados faltando na API)
 * derrubavam a gravação inteira, e o botão de adicionar ficava mudo.
 */
function semUndefined<T extends Record<string, any>>(obj: T): T {
  const saida: Record<string, any> = {};
  for (const [chave, valor] of Object.entries(obj)) {
    if (valor !== undefined) saida[chave] = valor;
  }
  return saida as T;
}

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
 * Com cache offline (persistentLocalCache), o Promise de setDoc/updateDoc
 * resolve assim que a escrita fica gravada localmente — NÃO espera o
 * servidor confirmar. Em conexões instáveis (o app já loga reconexões do
 * canal 'Listen' com frequência), isso pode fazer a tela de "carta
 * adicionada" aparecer mesmo quando a gravação nunca chegou ao Firestore:
 * o usuário vê sucesso, mas a carta não aparece de verdade na coleção.
 * Por isso confirmamos com uma leitura direta ao servidor (sem cache) antes
 * de considerar a gravação concluída. Se isso falhar, é melhor mostrar erro
 * e pedir para tentar de novo do que mentir sobre o que foi salvo.
 */
async function confirmarGravacao(ref: ReturnType<typeof doc>, esperado: (data: any) => boolean) {
  try {
    const snap = await getDocFromServer(ref);
    if (!snap.exists() || !esperado(snap.data())) {
      throw new Error('A gravação não foi confirmada pelo servidor. Tente novamente.');
    }
  } catch (err: any) {
    if (err?.message?.includes('não foi confirmada')) throw err;
    throw new Error('Não consegui confirmar se a carta foi salva. Verifique sua conexão e tente novamente.');
  }
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
    const novaQuantidade = match.quantity + card.quantity;
    const ref = doc(cardsRef(uid), match.id);
    await updateDoc(ref, {
      quantity: novaQuantidade,
      unitPrice: card.unitPrice,
      priceUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await confirmarGravacao(ref, (data) => data.quantity === novaQuantidade);
    return match.id;
  }

  const ref = doc(cardsRef(uid));
  await setDoc(ref, semUndefined(card));
  await confirmarGravacao(ref, (data) => data.tcgId === card.tcgId);
  return ref.id;
}

export async function updateCard(uid: string, cardId: string, patch: Partial<OwnedCard>) {
  await updateDoc(doc(cardsRef(uid), cardId), semUndefined({ ...patch, updatedAt: Date.now() }));
}

export async function removeCard(uid: string, cardId: string) {
  await deleteDoc(doc(cardsRef(uid), cardId));
}

export async function addToWishlist(uid: string, item: Omit<WishlistItem, 'id'>) {
  await setDoc(doc(wishlistRef(uid)), semUndefined(item));
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
    cards.slice(i, i + 400).forEach((c) => batch.set(doc(cardsRef(uid)), semUndefined(c)));
    await batch.commit();
  }
}
