// Capa visual: no modifica TXT, fragmentos ni tiempos del reproductor.
const normalized = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const wordCount = text => (text.match(/\S+/g) || []).length;

export function createVisualSections(structure, timeline = []) {
  let offset = 0, id = 0;
  const sections = structure.sequence.map((entry, occurrence) => {
    const source = entry.type === 'chorus' ? structure.chorus : structure.verses.find(v => v.number === entry.number);
    return { type: entry.type, verse: entry.number, occurrence,
      splitAfter: structure.hymnNumber === 31 && entry.type === 'verse' && entry.number === 1 ? 4 : null,
      rows: (source?.lines || []).map(text => {
      const start = offset;
      offset += normalized(text).length;
      return { id: id++, text, start, end: offset, cues: [] };
    }) };
  });
  const rows = sections.flatMap(s => s.rows);
  // La coincidencia se valida completa; nunca se inventan tiempos de versos.
  const aligned = rows.map(r => normalized(r.text)).join('') === timeline.map(l => normalized(l.text)).join('');
  if (aligned) {
    offset = 0;
    timeline.forEach((cue, index) => {
      const start = offset;
      offset += normalized(cue.text).length;
      for (const row of rows) if (row.end > start && row.start < offset) row.cues.push(index);
    });
  }
  return { sections, aligned: timeline.length === 0 || aligned };
}

const punctuation = text => /[.!?]["”']?$/.test(text) ? 4 : /[;:]["”']?$/.test(text) ? 3 : /,["”']?$/.test(text) ? 1 : 0;
function cost(parts) {
  const counts = parts.map(rows => wordCount(rows.map(r => r.text).join(' ')));
  const average = counts.reduce((a, b) => a + b, 0) / counts.length;
  return parts.reduce((score, rows, i) => score + Math.abs(counts[i] - average) * 2
    + Math.max(0, 15 - counts[i], counts[i] - 20) * 0.15
    + (rows.length === 1 ? 12 : 0) - punctuation(rows.at(-1).text), 0);
}

// fits recibe versos completos y mide el espacio real del navegador.
export function groupVisualSections(sections, fits) {
  return sections.flatMap(section => {
    const rows = section.rows;
    if (!rows.length) return [];
    let parts;
    if (section.splitAfter && section.splitAfter < rows.length) {
      parts = [rows.slice(0, section.splitAfter), rows.slice(section.splitAfter)];
    } else if (fits(rows.map(r => r.text))) parts = [rows];
    else {
      const pairs = [];
      for (let cut = 1; cut < rows.length; cut++) {
        const pair = [rows.slice(0, cut), rows.slice(cut)];
        if (pair.every(part => fits(part.map(r => r.text)))) pairs.push(pair);
      }
      // Cuando ambos lados caben, cuatro versos prefieren 2 + 2.
      parts = pairs.find(pair => rows.length === 4 && pair[0].length === 2)
        || pairs.sort((a, b) => cost(a) - cost(b))[0];
      if (!parts) {
        // Mínimo de partes legibles. Un verso indivisible demasiado alto usa scroll.
        const best = Array(rows.length + 1).fill(null);
        best[rows.length] = [];
        for (let start = rows.length - 1; start >= 0; start--) {
          for (let end = start + 1; end <= rows.length; end++) {
            const part = rows.slice(start, end);
            if (end > start + 1 && !fits(part.map(r => r.text))) continue;
            const candidate = [part, ...best[end]];
            if (!best[start] || candidate.length < best[start].length
              || (candidate.length === best[start].length && cost(candidate) < cost(best[start]))) best[start] = candidate;
          }
        }
        parts = best[0];
      }
    }
    return parts.map((part, index) => ({ ...section, rows: part, part: index + 1, parts: parts.length,
      id: `${section.occurrence}:${part[0].id}:${part.at(-1).id}`,
      scroll: !fits(part.map(r => r.text)), exceptional: parts.length > 2,
      firstCue: part.flatMap(r => r.cues).sort((a, b) => a - b)[0] ?? null,
    }));
  });
}

export function blockForCue(blocks, cue) {
  // Un cue que atraviesa varios versos se mantiene en el bloque de su inicio.
  return blocks.findIndex(block => block.rows.some(row => row.cues.includes(cue)));
}
