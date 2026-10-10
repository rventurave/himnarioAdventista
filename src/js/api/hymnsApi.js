import API_CONFIG, { configure, getConfig } from "../core/config.js";
import { fetchWithTimeout } from "../utils/fetchWithTimeout.js";
import { validateCatalog } from "../utils/validators.js";
import { resolveAudioUrl } from "../utils/audioUrl.js";

export { configure, getConfig };

//Obtiene todo el catálogo de himnos

export async function fetchHymnCatalog() {
  const response = await fetchWithTimeout(API_CONFIG.baseUrl);

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("La respuesta no es JSON válido");
  }

  return validateCatalog(data);
}

//Busca himnos por número o título
export async function searchHymns(query) {
  const hymns = await fetchHymnCatalog();

  const search = query.trim().toLowerCase();

  if (!search) {
    return [];
  }

  return hymns.filter((hymn) => {
    const number = String(hymn.number);
    const title = String(hymn.title).toLowerCase();

    return number === search || title.includes(search);
  });
}

//Obtiene un himno por su ID.
export async function getHymnById(id) {
  const hymns = await fetchHymnCatalog();

  return hymns.find((hymn) => String(hymn.id) === String(id)) || null;
}

//Obtiene un himno por su número.
export async function getHymnByNumber(number) {
  const hymns = await fetchHymnCatalog();

  return hymns.find((hymn) => String(hymn.number) === String(number)) || null;
}

//Busca un himno por número o, si no coincide, por id.
export async function findHymn(identifier) {
  const byNumber = await getHymnByNumber(identifier);

  return byNumber || (await getHymnById(identifier));
}

//Devuelve la URL absoluta de la letra (.txt) del himno.
export function getHymnLyricsUrl(hymn) {
  if (!hymn || !hymn.txtRoute) {
    return null;
  }

  return resolveDataUrl(hymn.txtRoute);
}

//Devuelve las URLs candidatas del archivo de sincronización (.lrc), en orden.
//1) mismo nombre que el .txt  2) mismo nombre que el mp3  3) número con ceros
export function getHymnLrcUrls(hymn) {
  if (!hymn) {
    return [];
  }

  const candidates = [];
  const push = (url) => {
    if (url && !candidates.includes(url)) {
      candidates.push(url);
    }
  };

  const lyricsUrl = getHymnLyricsUrl(hymn);

  if (lyricsUrl) {
    push(lyricsUrl.replace(/\.txt(\?.*)?$/i, ".lrc"));
  }

  if (hymn.mp3Filename) {
    push(resolveDataUrl(`/letras/${String(hymn.mp3Filename).replace(/\.mp3$/i, ".lrc")}`));
  }

  if (hymn.number !== undefined && hymn.number !== null && String(hymn.number).trim() !== "") {
    push(resolveDataUrl(`/letras/${String(hymn.number).padStart(3, "0")}.lrc`));
  }

  return candidates;
}

//URL principal del .lrc (primera candidata).
export function getHymnLrcUrl(hymn) {
  return getHymnLrcUrls(hymn)[0] || null;
}

//URLs candidatas del archivo de sincronización vocal (.sync.json), en orden.
//Viven en /data/sync/ con las mismas convenciones de nombre que el .lrc.
export function getHymnSyncUrls(hymn) {
  if (!hymn) {
    return [];
  }

  const candidates = [];
  const push = (url) => {
    if (url && !candidates.includes(url)) {
      candidates.push(url);
    }
  };

  const txtName = hymn.txtRoute ? String(hymn.txtRoute).split("/").pop() : null;

  if (txtName) {
    push(resolveDataUrl(`/sync/${txtName.replace(/\.txt(\?.*)?$/i, ".sync.json")}`));
  }

  if (hymn.mp3Filename) {
    push(resolveDataUrl(`/sync/${String(hymn.mp3Filename).replace(/\.mp3$/i, ".sync.json")}`));
  }

  if (hymn.number !== undefined && hymn.number !== null && String(hymn.number).trim() !== "") {
    push(resolveDataUrl(`/sync/${String(hymn.number).padStart(3, "0")}.sync.json`));
  }

  return candidates;
}

function resolveDataUrl(route) {
  if (/^https?:\/\//.test(route)) {
    return route;
  }

  return `${API_CONFIG.dataBaseUrl}${route.startsWith("/") ? "" : "/"}${route}`;
}

//Devuelve la ruta del audio según el modo de reproducción.
export function getHymnAudioUrl(hymn, mode = "musica") {
  if (!hymn) {
    return null;
  }

  const instrumental = mode === "instrumental" || mode === "karaoke";
  const route = instrumental
    ? hymn.mp3RouteInstr || hymn.mp3UrlInstr
    : hymn.mp3Route || hymn.mp3Url;
  return resolveAudioUrl(route, instrumental ? "instrumentales" : "cantadas", API_CONFIG.audioBaseUrl);
}
