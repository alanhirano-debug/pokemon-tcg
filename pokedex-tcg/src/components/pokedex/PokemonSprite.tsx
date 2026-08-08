import { useEffect, useMemo, useRef, useState } from 'react';
import { spriteChain, toSpriteSlug } from '@/services/sprites';
import type { SpriteStyle } from '@/types';

interface Props {
  id: number;
  name: string;
  slug?: string;
  /** Não obtido = sprite em cinza, igual à Pokédex dos jogos. */
  owned?: boolean;
  size?: number;
  style?: SpriteStyle;
  animated?: boolean;
  shiny?: boolean;
  className?: string;
  /** Fora da viewport a imagem nem entra na fila de download. */
  eager?: boolean;
}

/**
 * Sprite 2D com fallback automático.
 * Se a primeira fonte falhar (404, offline, forma sem sprite), desce a
 * cadeia até achar uma que carregue. Nunca renderiza modelo 3D.
 */
export function PokemonSprite({
  id,
  name,
  slug,
  owned = true,
  size = 64,
  style = 'pixel',
  animated = true,
  shiny = false,
  className = '',
  eager = false,
}: Props) {
  const chain = useMemo(
    () => spriteChain({ id, slug: slug ?? toSpriteSlug(name.toLowerCase()), style, animated, shiny }),
    [id, name, slug, style, animated, shiny],
  );

  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const exhausted = useRef(false);

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
    exhausted.current = false;
  }, [chain]);

  const handleError = () => {
    if (index < chain.length - 1) {
      setIndex((i) => i + 1);
    } else {
      exhausted.current = true;
      setLoaded(true);
    }
  };

  if (exhausted.current) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`grid place-items-center rounded-lg bg-ink-500/60 ${className}`}
        aria-label={`${name}: sprite indisponível`}
      >
        <span className="font-dex text-[10px] text-mist">?</span>
      </div>
    );
  }

  return (
    <img
      src={chain[index]}
      alt={owned ? name : `${name} (não obtido)`}
      width={size}
      height={size}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={handleError}
      draggable={false}
      className={[
        'pixelated select-none object-contain transition duration-300',
        owned ? '' : 'sprite-locked',
        loaded ? 'opacity-100' : 'opacity-0',
        className,
      ].join(' ')}
      style={{ width: size, height: size }}
    />
  );
}
