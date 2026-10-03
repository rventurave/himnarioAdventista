import { parseHymn } from "../utils/hymnParser.js";
import { estimateTimeline, timelineFromLrc, timelineFromSync } from "../utils/lyricsTimeline.js";
import { analyzeAudio } from "./audioAnalysis.js";
import { getHymnAudioUrl, getHymnLrcUrls, getHymnLyricsUrl, getHymnSyncUrls } from "../api/hymnsApi.js";
import { fetchWithTimeout } from "../utils/fetchWithTimeout.js";
import { parseLRC } from "../utils/lrcParser.js";
import { parseSyncJson } from "../utils/syncParser.js";
import { splitLyricsIntoSlides } from "../utils/lyricsSplitter.js";

/*
 * Caché de letras: evita volver a descargar el mismo himno.
 * id -> { plain, synced, slides, structure, envelope, vocal }
 */
const lyricsCache = new Map();

function getEntry(hymn) {
  if (!hymn) {
    return null;
  }

  const key = String(hymn.id);

  if (!lyricsCache.has(key)) {
    lyricsCache.set(key, { plain: null, synced: null, slides: null });
  }

  return lyricsCache.get(key);
}

//Depuración opt-in: añade ?debug=lrc a la URL (o localStorage.lrcDebug = "1").
function isLrcDebug() {
  try {
    return (
      new URLSearchParams(window.location.search).get("debug") === "lrc" ||
      window.localStorage.getItem("lrcDebug") === "1"
    );
  } catch {
    return false;
  }
}

async function fetchText(url) {
  if (!url) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

//Descarga una candidata .lrc y devuelve { text, status } (text null si falla).
async function fetchLrcCandidate(url) {
  if (!url) {
    return { url, status: 0, text: null };
  }

  try {
    const response = await fetchWithTimeout(url);
    const text = response.ok ? await response.text() : null;

    return { url, status: response.status, statusText: response.statusText, text };
  } catch (error) {
    return { url, status: 0, statusText: String(error), text: null };
  }
}

/**
 * Devuelve la letra sin sincronizar (.txt).
 */
export async function getPlainLyrics(hymn) {
  const entry = getEntry(hymn);

  if (!entry) {
    return "";
  }

  if (entry.plain !== null) {
    return entry.plain;
  }

  const text = await fetchText(getHymnLyricsUrl(hymn));

  entry.plain = (text || "").trim();

  return entry.plain;
}

/**
 * Devuelve la letra sincronizada (.lrc) ya parseada.
 * Prueba las rutas candidatas del himno y usa la primera que exista.
 * Si ninguna existe o está vacía, { synced: false, lines: [] }.
 */
export async function getSyncedLyrics(hymn) {
  const entry = getEntry(hymn);

  if (!entry) {
    return { synced: false, lines: [] };
  }

  if (entry.synced) {
    return entry.synced;
  }

  const debug = isLrcDebug();
  const candidates = getHymnLrcUrls(hymn);

  let lines = [];
  let usedUrl = null;

  for (const url of candidates) {
    const { status, text } = await fetchLrcCandidate(url);

    if (debug) {
      console.log(
        `[LRC] himno ${hymn.number} -> ${url} -> HTTP ${status}${text === null ? " (sin contenido)" : ""}`,
      );
    }

    if (text === null) {
      continue;
    }

    const parsed = parseLRC(text);

    if (debug) {
      console.log(`[LRC] himno ${hymn.number}: ${parsed.length} líneas parseadas`);
    }

    if (parsed.length > 0) {
      lines = parsed;
      usedUrl = url;
      break;
    }
  }

  if (debug) {
    console.log("[LRC]", {
      hymnId: hymn.id,
      number: hymn.number,
      mp3Url: hymn.mp3Route,
      mp3UrlInstr: hymn.mp3RouteInstr,
      lrcUrl: usedUrl,
      lineas: lines.length,
    });
  }

  entry.synced = { synced: lines.length > 0, lines, url: usedUrl };

  return entry.synced;
}

/**
 * Descarga y valida el .sync.json (tiempos vocales reales) del himno.
 * Prueba las rutas candidatas y usa la primera válida; si no hay, null.
 */
export async function getVocalSync(hymn) {
  const entry = getEntry(hymn);

  if (!entry) {
    return null;
  }

  if (entry.vocal !== undefined) {
    return entry.vocal;
  }

  let result = null;

  for (const url of getHymnSyncUrls(hymn)) {
    const text = await fetchText(url);
    const parsed = parseSyncJson(text);

    if (parsed) {
      result = parsed;
      break;
    }
  }

  entry.vocal = result;

  return result;
}

/**
 * Devuelve la letra dividida en fragmentos para el modo Solo letra.
 */
export async function getSlides(hymn) {
  const entry = getEntry(hymn);

  if (!entry) {
    return [];
  }

  if (entry.slides) {
    return entry.slides;
  }

  const plain = await getPlainLyrics(hymn);

  entry.slides = splitLyricsIntoSlides(plain);

  return entry.slides;
}

/**
 * Limpia la caché completa o la de un himno puntual.
 */
export function clearLyricsCache(id) {
  if (id === undefined) {
    lyricsCache.clear();
    return;
  }

  lyricsCache.delete(String(id));
}

/** Estructura independiente de la presentación del modo Letra. */
export async function getStructuredLyrics(hymn) {
  const entry = getEntry(hymn);
  if (!entry) return parseHymn('');
  if (!entry.structure) entry.structure = parseHymn(await getPlainLyrics(hymn));
  return entry.structure;
}

/** Mismo reloj base para Cantado y Karaoke: analiza preferentemente la grabación cantada. */
export async function getPlaybackLyrics(hymn, signal) {
  const [structure, synced, vocal] = await Promise.all([
    getStructuredLyrics(hymn),
    getSyncedLyrics(hymn),
    getVocalSync(hymn),
  ]);
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');

  //1) Tiempos guardados en .sync.json (voz real o respaldo aproximado marcado).
  const aligned = timelineFromSync(structure, vocal);
  if (aligned) {
    return {
      lines: aligned,
      estimated: vocal.syncMethod === 'estimated',
      syncMethod: vocal.syncMethod,
      confidence: vocal.confidence,
      needsReview: vocal.needsReview === true,
    };
  }

  //2) LRC revisado que cubra toda la secuencia.
  const exact = timelineFromLrc(structure, synced.lines);
  if (exact) return { lines: exact, estimated: false, syncMethod: 'lrc', confidence: null };

  //3) Respaldo: estimación acústica (envolvente de energía), marcada como aproximada.
  const url = getHymnAudioUrl(hymn) || getHymnAudioUrl(hymn, 'instrumental');
  if (!url) return { lines: [], estimated: false, syncMethod: 'none', confidence: null };
  const entry = getEntry(hymn);
  if (!entry.envelope) entry.envelope = await analyzeAudio(url, signal);
  return { lines: estimateTimeline(structure, entry.envelope), estimated: true, syncMethod: 'estimated', confidence: null };
}
