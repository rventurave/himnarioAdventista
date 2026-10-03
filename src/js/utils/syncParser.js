/*
 * Parser del archivo de sincronización vocal (.sync.json).
 *
 * El JSON se genera offline con herramientas de alineación vocal (tools/vocal_sync.py).
 * Este módulo solo valida su forma; la letra mostrada sigue saliendo del TXT.
 */

//Devuelve { syncMethod, confidence, lines } o null si el contenido no es válido.
export function parseSyncJson(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  if (!data || typeof data !== "object" || !Array.isArray(data.lines) || !data.lines.length) {
    return null;
  }

  const lines = [];

  for (const line of data.lines) {
    const start = Number(line?.start);
    const end = Number(line?.end);

    if (!line || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return null;
    }

    lines.push({
      type: line.type === "chorus" ? "chorus" : "verse",
      ...(line.type === "verse" ? { verse: Number(line.verse) } : {}),
      occurrence: Number.isFinite(Number(line.occurrence)) ? Number(line.occurrence) : undefined,
      text: typeof line.text === "string" ? line.text : "",
      start,
      end,
      confidence: Number.isFinite(Number(line.confidence)) ? Number(line.confidence) : null,
    });
  }

  return {
    syncMethod: typeof data.syncMethod === "string" ? data.syncMethod : "unknown",
    confidence: Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : null,
    needsReview: data.needsReview === true,
    lines,
  };
}
