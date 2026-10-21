import { useState } from "react";
import { itemSpriteUrl, resolvePokemonSpriteUrl } from "../data/pokemonSprites.js";

export function PokemonSprite({ pokemon, name, size = 72, priority = false, decorative = false, className = "" }) {
  const label = name || pokemon?.name || pokemon?.speciesName || "Pokémon";
  const fallbackLabel = pokemon?.speciesName || pokemon?.baseSpecies || pokemon?.name || label;
  const src = resolvePokemonSpriteUrl(pokemon);
  const [failedSrc, setFailedSrc] = useState("");
  const [loadedSrc, setLoadedSrc] = useState("");
  const failed = !src || failedSrc === src;
  const loading = Boolean(src) && !failed && loadedSrc !== src;

  return (
    <span
      className={`pokemon-art${failed ? " is-fallback" : loading ? " is-loading" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--sprite-size": `${size}px` }}
      data-pokemon-slug={pokemon?.slug || undefined}
      data-sprite-url={src || undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : (failed ? `${label}, sprite indisponível` : label)}
      aria-hidden={decorative || undefined}
    >
      {!failed ? (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          width={size}
          height={size}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className={loading ? "is-loading" : "is-loaded"}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
        />
      ) : null}
      {(failed || loading) && <span className="pokemon-art-fallback" aria-hidden="true">{fallbackLabel.slice(0, 2).toLocaleUpperCase("pt-BR")}</span>}
    </span>
  );
}

export function ItemSprite({ name, size = 24, className = "" }) {
  const src = itemSpriteUrl(name);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      className={`item-sprite${className ? ` ${className}` : ""}`}
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
