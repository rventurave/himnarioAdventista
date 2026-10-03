import { expandHymn } from './hymnParser.js';

const normalize = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Solo usa LRC completo: un coro escrito una vez no aporta tiempos para sus repeticiones.
export function timelineFromLrc(structure, lrc, duration = Infinity) {
  const fragments = expandHymn(structure);
  const sung = lrc.filter(cue => cue.text);
  if (!sung.length || sung.map(cue => normalize(cue.text)).join('') !== fragments.map(fragment => normalize(fragment.text)).join('')) return null;
  let cursor = 0, offset = 0;
  const timeline = [];
  for (let i = 0; i < lrc.length; i++) {
    const cue = lrc[i];
    if (!cue.text) continue;
    while (cursor < fragments.length - 1 && offset >= normalize(fragments[cursor].text).length) {
      offset -= normalize(fragments[cursor++].text).length;
    }
    const end = Math.min(lrc[i + 1]?.time ?? duration, duration);
    if (end <= cue.time) return null;
    timeline.push({ ...fragments[cursor], text: cue.text, start: cue.time, time: cue.time, end });
    offset += normalize(cue.text).length;
  }
  return timeline;

}

//Tiempos guardados en .sync.json. Acepta alineación vocal real y el respaldo
//aproximado. Exige coincidencia exacta con los fragmentos del TXT: si la letra
//cambió, el archivo queda obsoleto y se ignora.
export function timelineFromSync(structure, sync) {
  if (!sync || !Array.isArray(sync.lines)) return null;
  if (sync.syncMethod !== 'vocal-alignment' && sync.syncMethod !== 'estimated') return null;
  const fragments = expandHymn(structure);
  if (fragments.length !== sync.lines.length) return null;
  const timeline = [];
  for (let i = 0; i < fragments.length; i++) {
    const fragment = fragments[i];
    const line = sync.lines[i];
    if (line.type !== fragment.type) return null;
    if (fragment.type === 'verse' && line.verse !== fragment.verse) return null;
    if (line.occurrence !== undefined && line.occurrence !== fragment.occurrence) return null;
    if (!(line.end > line.start)) return null;
    timeline.push({
      ...fragment,
      start: line.start,
      time: line.start,
      end: line.end,
      confidence: line.confidence,
    });
  }
  return timeline;
}

export function phraseWeight(text) {
  return Math.max(1, (text.toLowerCase().match(/[aeiouáéíóúü]+/g) || []).length)
    + (/[.;?!]["”']?$/.test(text) ? 1.5 : 0.5);
}

// Estimación acústica: longitud vocal + mínimos locales de energía, no reparto por líneas.
export function estimateTimeline(structure, envelope) {
  const fragments = expandHymn(structure);
  const { energy, step, duration } = envelope;
  if (!fragments.length || !energy.length || !(duration > 0)) return [];
  const peak = Math.max(...energy);
  if (!peak) return [];
  const threshold = peak * 0.035;
  const first = energy.findIndex(value => value > threshold);
  let last = energy.length - 1;
  while (last > first && energy[last] <= threshold) last--;
  const start = first * step;
  const finish = Math.min(duration, (last + 1) * step);
  const weights = fragments.map(fragment => phraseWeight(fragment.text));
  const total = weights.reduce((a, b) => a + b, 0);
  const boundaries = [start];
  let accumulated = 0;
  for (let i = 1; i < fragments.length; i++) {
    accumulated += weights[i - 1];
    const target = start + (finish - start) * accumulated / total;
    const span = (finish - start) * Math.min(weights[i - 1], weights[i]) / total;
    const radius = Math.min(1.5, span * 0.3);
    let best = target;
    let score = Infinity;
    for (let bin = Math.ceil((target - radius) / step); bin <= Math.floor((target + radius) / step); bin++) {
      const time = bin * step;
      if (bin < 0 || bin >= energy.length || time <= boundaries[i - 1]) continue;
      const candidate = energy[bin] / peak + 0.35 * Math.abs(time - target) / (radius || 1);
      if (candidate < score) { score = candidate; best = time; }
    }
    boundaries.push(best);
  }
  boundaries.push(finish);
  return fragments.map((fragment, i) => ({ ...fragment, start: boundaries[i], time: boundaries[i], end: boundaries[i + 1] }));
}

export function findActiveIndex(lines, time) {
  // El reloj del medio redondea decimales (18.4 frente a 18.400000000000002).
  const clock = time + 0.000001;
  let low = 0, high = lines.length - 1, result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].start <= clock) { result = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return result >= 0 && clock < lines[result].end ? result : -1;
}
