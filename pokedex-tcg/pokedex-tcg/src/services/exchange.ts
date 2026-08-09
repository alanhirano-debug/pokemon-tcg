// ─────────────────────────────────────────────────────────────
// COTAÇÃO
//
// A Pokémon TCG API entrega preços em dólar (TCGplayer) e euro
// (Cardmarket). Converter com um número cravado no código envelhece mal,
// então a cotação vem da AwesomeAPI — gratuita, brasileira, sem chave.
//
// Uma consulta por dia. O resultado fica em IndexedDB com a data, e a
// próxima abertura no mesmo dia usa o cache. Se a rede falhar, cai para
// a última cotação conhecida; se nem essa existir, para um valor fixo.
// O app nunca fica sem preço por causa de câmbio.
// ─────────────────────────────────────────────────────────────

import { get, set } from 'idb-keyval';

const CACHE_KEY = 'fx-rates-v1';
const ENDPOINT = 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL';

/** Último recurso: usado só quando nunca houve uma cotação bem-sucedida. */
export const FALLBACK_RATES: Rates = { usd: 5.4, eur: 5.9 };

export interface Rates {
  usd: number;
  eur: number;
}

export interface FxState extends Rates {
  updatedAt: number;
  /** true quando a cotação veio da rede nesta sessão ou hoje. */
  live: boolean;
}

interface CachedFx {
  day: string; // AAAA-MM-DD
  rates: Rates;
  at: number;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function getRates(): Promise<FxState> {
  const cached = await get<CachedFx>(CACHE_KEY);

  if (cached?.day === today()) {
    return { ...cached.rates, updatedAt: cached.at, live: true };
  }

  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();

    const rates: Rates = {
      usd: Number(data.USDBRL?.bid),
      eur: Number(data.EURBRL?.bid),
    };

    if (!isSane(rates)) throw new Error('cotação fora da faixa esperada');

    const at = Date.now();
    await set(CACHE_KEY, { day: today(), rates, at } satisfies CachedFx);
    return { ...rates, updatedAt: at, live: true };
  } catch {
    // Cotação de ontem serve melhor do que nenhuma.
    if (cached) return { ...cached.rates, updatedAt: cached.at, live: false };
    return { ...FALLBACK_RATES, updatedAt: 0, live: false };
  }
}

/**
 * Trava de sanidade. Se a API mudar de formato ou devolver lixo, um
 * número absurdo multiplicaria a coleção inteira sem ninguém perceber.
 */
function isSane({ usd, eur }: Rates): boolean {
  const ok = (n: number) => Number.isFinite(n) && n > 1 && n < 30;
  return ok(usd) && ok(eur);
}

export function convert(amount: number, currency: 'USD' | 'EUR', rates: Rates): number {
  const rate = currency === 'EUR' ? rates.eur : rates.usd;
  return Math.round(amount * rate * 100) / 100;
}

/** "há 3 horas", para mostrar quando a cotação foi buscada. */
export function sinceLabel(timestamp: number): string {
  if (!timestamp) return 'cotação de referência';
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} dias`;
}
