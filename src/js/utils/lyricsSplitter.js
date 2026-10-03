const VERSE_NUMBER_PATTERN = /^\s*\d{1,3}\s*$/;
const CHORUS_PATTERN = /^\s*(coro|estribillo)\s*:?\s*$/i;

const MIN_SLIDE_CHARS = 12;
const SOFT_MAX_CHARS = 140;

/**
 * Divide la letra de un himno en fragmentos para mostrar de a uno.
 *
 * Respeta estrofas (separadas por líneas vacías), corta principalmente en
 * puntuación fuerte (. ! ? ; :) y evita fragmentos demasiado chicos.
 *
 *   splitLyricsIntoSlides(lyrics) -> ["Santo, santo, santo.", "Señor omnipotente."]
 */
export function splitLyricsIntoSlides(lyrics) {
  if (!lyrics || typeof lyrics !== "string") {
    return [];
  }

  return toStanzas(lyrics).flatMap(splitStanza);
}

/**
 * Separa el texto en estrofas, descartando numeros de verso y marcadores de coro.
 */
function toStanzas(lyrics) {
  const stanzas = [];
  let current = [];

  lyrics
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line) {
        if (current.length) {
          stanzas.push(current);
          current = [];
        }
        return;
      }

      if (VERSE_NUMBER_PATTERN.test(line)) {
        return;
      }

      // El marcador de coro no es letra: solo separa estrofas.
      if (CHORUS_PATTERN.test(line)) {
        if (current.length) {
          stanzas.push(current);
          current = [];
        }
        return;
      }

      current.push(line);
    });

  if (current.length) {
    stanzas.push(current);
  }

  return stanzas;
}

function splitStanza(lines) {
  const fragments = splitByStrongPunctuation(lines.join("\n"));

  return mergeSmallFragments(fragments).flatMap((fragment) =>
    splitLongFragment(fragment),
  );
}

function splitByStrongPunctuation(text) {
  return text
    .split(/(?<=[.!?;:])\s+/)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
}

/**
 * Une fragmentos demasiado cortos con el vecino anterior de la misma estrofa.
 */
function mergeSmallFragments(fragments) {
  const result = [];

  fragments.forEach((fragment) => {
    const previous = result[result.length - 1];

    const shouldMerge =
      previous &&
      (previous.length < MIN_SLIDE_CHARS || fragment.length < MIN_SLIDE_CHARS) &&
      previous.length + fragment.length + 1 <= SOFT_MAX_CHARS;

    if (shouldMerge) {
      result[result.length - 1] = `${previous} ${fragment}`;
    } else {
      result.push(fragment);
    }
  });

  return result;
}

/**
 * Subdivide un fragmento demasiado largo por comas, sin superar el máximo.
 */
function splitLongFragment(fragment) {
  if (fragment.length <= SOFT_MAX_CHARS) {
    return [fragment];
  }

  const parts = fragment.split(/(?<=,)\s+/);
  const chunks = [];
  let current = "";

  parts.forEach((part) => {
    if (current && `${current} ${part}`.length > SOFT_MAX_CHARS) {
      chunks.push(current);
      current = part;
    } else {
      current = current ? `${current} ${part}` : part;
    }
  });

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
