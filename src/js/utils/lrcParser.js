const TIME_TAG_PATTERN = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const METADATA_PATTERN = /^\[(ti|ar|al|by|offset|re|ve|length):/i;

/**
 * Convierte "mm", "ss" y fracción decimal en segundos.
 */
function toSeconds(minutes, seconds, fraction) {
  const mins = parseInt(minutes, 10);
  const secs = parseInt(seconds, 10);

  if (!Number.isFinite(mins) || !Number.isFinite(secs) || secs >= 60) {
    return NaN;
  }

  let milliseconds = 0;

  if (fraction) {
    // ".2" = 200ms, ".20" = 200ms, ".205" = 205ms
    const padded = String(fraction).padEnd(3, "0").slice(0, 3);
    milliseconds = parseInt(padded, 10) / 1000;
  }

  return mins * 60 + secs + milliseconds;
}

/**
 * Convierte el texto de un archivo .lrc en una lista ordenada de líneas.
 *
 *   [00:05.20]Segunda línea  ->  { time: 5.2, text: "Segunda línea" }
 *
 * Ignora líneas vacías, metadatos y entradas malformadas.
 * Nunca lanza: ante un texto inválido devuelve [].
 */
export function parseLRC(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  const lines = [];
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line || METADATA_PATTERN.test(line)) {
      return;
    }

    TIME_TAG_PATTERN.lastIndex = 0;

    const times = [];
    let match;

    while ((match = TIME_TAG_PATTERN.exec(line)) !== null) {
      const time = toSeconds(match[1], match[2], match[3]);

      if (Number.isFinite(time)) {
        times.push(time);
      }
    }

    if (times.length === 0) {
      return;
    }

    const content = line.replace(TIME_TAG_PATTERN, "").trim();

    times.forEach((time) => {
      lines.push({ time: Math.max(0, time + offset), text: content });
    });
  });

  return lines.sort((a, b) => a.time - b.time);
}
