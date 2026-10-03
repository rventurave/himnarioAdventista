// La estructura depende de marcadores, nunca de la cantidad de renglones.
export function parseHymn(text) {
  const verses = [];
  let chorus = null;
  let section = null;
  const rows = String(text || '').replace(/\uFEFF/g, '').split(/\r\n?|\n/);
  const numbered = rows.some(row => /^\s*(?:estrofa\s+)?\d+\s*[.):º°-]?\s*$/i.test(row));
  for (const raw of rows) {
    const line = raw.trim();
    const verse = line.match(/^(?:estrofa\s+)?(\d+)\s*[.):º°-]?$/i);
    const refrain = line.match(/^(?:coro|estribillo)\s*[:.：-]?\s*$/i);
    if (verse) {
      section = { number: Number(verse[1]), lines: [] };
      verses.push(section);
    } else if (refrain) {
      // Una repetición explícita del encabezado no duplica el coro en memoria.
      section = { lines: [] };
      if (!chorus || !chorus.lines.length) chorus = section;
    } else if (line) {
      if (!section) {
        section = { number: verses.length + 1, lines: [] };
        verses.push(section);
      }
      section.lines.push(line);
    } else if (!numbered && section !== chorus) {
      section = null;
    }
  }
  const nonempty = verses.filter(verse => verse.lines.length);
  if (!chorus?.lines.length) chorus = null;
  return {
    verses: nonempty, chorus,
    sequence: nonempty.length ? nonempty.flatMap(verse => [
      { type: 'verse', number: verse.number },
      ...(chorus ? [{ type: 'chorus' }] : []),
    ]) : chorus ? [{ type: 'chorus' }] : [],
  };
}

export function splitPhrase(line) {
  // Conserva las frases cortas (incluyendo «Di:») y su puntuación.
  const parts = line.split(/(?<=[,.;:?!])\s+/);
  const result = [];
  let pending = '';
  for (const part of parts) {
    pending = pending ? `${pending} ${part}` : part;
    if (pending.length >= 28) { result.push(pending); pending = ''; }
  }
  if (pending) {
    if (result.length && pending.length < 18) result[result.length - 1] += ` ${pending}`;
    else result.push(pending);
  }
  return result;
}

export function expandHymn(structure) {
  return structure.sequence.flatMap((section, occurrence) => {
    const source = section.type === 'chorus' ? structure.chorus
      : structure.verses.find(verse => verse.number === section.number);
    return (source?.lines || []).flatMap(splitPhrase).map(text => ({
      type: section.type,
      ...(section.type === 'verse' ? { verse: section.number } : {}),
      occurrence, text,
    }));
  });
}
