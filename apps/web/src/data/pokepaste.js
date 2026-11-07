export function getPokepasteRawUrl(value) {
  try {
    const url = new URL(value);
    const id = url.pathname.match(/^\/([a-z0-9]{8,64})(?:\/raw)?\/?$/i)?.[1];
    if (url.protocol !== "https:" || !["pokepast.es", "www.pokepast.es"].includes(url.hostname.toLowerCase()) || url.username || url.password || url.search || url.hash || !id) return null;
    return `https://pokepast.es/${id}/raw`;
  } catch {
    return null;
  }
}
