import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { parseHymn, expandHymn } from '../src/js/utils/hymnParser.js';
import { estimateTimeline, findActiveIndex, timelineFromLrc, timelineFromSync } from '../src/js/utils/lyricsTimeline.js';
import { parseLRC } from '../src/js/utils/lrcParser.js';
import { parseSyncJson } from '../src/js/utils/syncParser.js';
import { splitLyricsIntoSlides } from '../src/js/utils/lyricsSplitter.js';

const example = '\uFEFF 1\r\nUna primera frase;\r\nsegunda frase.\n\n CORO : \nCanta con amor.\n\n2.\nOtra estrofa.\n3\nFinal.\nMás líneas.\nTodavía otra.';
test('marcadores tolerantes, líneas variables y repeticiones del coro', () => {
  const structure = parseHymn(example);
  assert.deepEqual(structure.verses.map(v => v.lines.length), [2, 1, 3]);
  assert.deepEqual(structure.sequence.map(s => s.type === 'verse' ? s.number : 'C'), [1,'C',2,'C',3,'C']);
  assert.equal(expandHymn(structure).filter(s => s.type === 'chorus').length, 3);
  for (const label of ['Coro', 'CORO:', 'estribillo', 'Coro：']) {
    assert.equal(parseHymn(`1\nTexto\n${label}\nCantar\n2\nFin`).chorus.lines[0], 'Cantar');
  }
  assert.equal(parseHymn('').sequence.length, 0);
  assert.equal(parseHymn('Una estrofa\n\nOtra estrofa').verses.length, 2);
  assert.equal(parseHymn('Coro:\nSolo coro').sequence.length, 1);
});
test('LRC completo, repetición ausente, silencios, offset y subdivisión', () => {
  const structure = parseHymn('1\nPrimera frase.\nCoro:\nCanta.\n2\nSegunda frase.');
  const lrc = parseLRC('[offset:500]\n[00:01]Primera\n[00:02]frase.\n[00:03]Canta.\n[00:04]\n[00:05]Segunda frase.\n[00:06]Canta.\n[00:07]');
  const timeline = timelineFromLrc(structure, lrc, 10);
  assert.equal(timeline[0].start, 1.5);
  assert.equal(timeline.at(-1).end, 7.5);
  assert.equal(findActiveIndex(timeline, 4.6), -1);
  assert.equal(timeline.at(-1).type, 'chorus');
  assert.equal(timelineFromLrc(structure, lrc.slice(0, -2)), null);
  assert.deepEqual(parseLRC('[00:99]Incorrecto'), []);
});
test('pausas acústicas, límites, seek en ambos sentidos y fin', () => {
  const structure = parseHymn(example);
  const energy = Array.from({length: 1000}, (_, i) => i < 50 || i > 949 ? 0 : i % 60 < 4 ? 0.02 : 1);
  const timeline = estimateTimeline(structure, { energy, step: 0.1, duration: 100 });
  assert.equal(timeline[0].start, 5);
  assert.equal(timeline.at(-1).end, 95);
  for (let i = timeline.length - 1; i >= 0; i--) {
    assert.ok(timeline[i].end > timeline[i].start);
    assert.equal(findActiveIndex(timeline, timeline[i].start), i);
  }
  assert.equal(findActiveIndex(timeline, 0), -1);
  assert.equal(findActiveIndex(timeline, 100), -1);
  assert.equal(findActiveIndex([{start:18.400000000000002, end:20}], 18.4), 0);
  assert.ok(new Set(timeline.map(l => (l.end-l.start).toFixed(1))).size > 2);
});
test('sincronización vocal: JSON válido, texto del TXT y descarte de obsoletos', () => {
  const structure = parseHymn('1\nPrimera frase.\nCoro:\nCanta con amor.\n2\nSegunda frase.');
  const fragments = expandHymn(structure);
  const lines = fragments.map((f, i) => ({ ...f, start: i * 2, end: i * 2 + 1.5, confidence: 0.9 }));
  const sync = { syncMethod: 'vocal-alignment', confidence: 0.9, lines };
  const timeline = timelineFromSync(structure, sync);
  assert.equal(timeline.length, fragments.length);
  assert.equal(timeline[0].start, 0);
  assert.equal(timeline[1].type, 'chorus');
  // Aunque el JSON traiga otro texto, manda el TXT oficial.
  const tampered = { ...sync, lines: lines.map((l) => ({ ...l, text: 'OTRO TEXTO' })) };
  assert.equal(timelineFromSync(structure, tampered)[0].text, fragments[0].text);
  // El respaldo aproximado también se acepta (marcado como estimated).
  assert.equal(timelineFromSync(structure, { ...sync, syncMethod: 'estimated' }).length, fragments.length);
  // Un método desconocido no se acepta.
  assert.equal(timelineFromSync(structure, { ...sync, syncMethod: 'lrc' }), null);
  assert.equal(timelineFromSync(structure, { ...sync, syncMethod: 'unknown' }), null);
  // Si la letra cambió (otra cantidad de fragmentos), el archivo queda obsoleto.
  assert.equal(timelineFromSync(structure, { ...sync, lines: lines.slice(1) }), null);
  // Tiempos inválidos se rechazan.
  assert.equal(timelineFromSync(structure, { ...sync, lines: lines.map((l, i) => i ? l : { ...l, end: l.start }) }), null);
});

test('parseSyncJson valida la forma del archivo vocal', () => {
  assert.equal(parseSyncJson('no es json'), null);
  assert.equal(parseSyncJson('{"syncMethod":"vocal-alignment","lines":[]}'), null);
  assert.equal(parseSyncJson(JSON.stringify({ lines: [{ start: 2, end: 1 }] })), null);
  const good = parseSyncJson(JSON.stringify({
    syncMethod: 'vocal-alignment',
    confidence: 0.8,
    lines: [{ type: 'verse', verse: 1, occurrence: 0, text: 'Hola', start: 1, end: 2, confidence: 0.9 }],
  }));
  assert.equal(good.syncMethod, 'vocal-alignment');
  assert.equal(good.lines[0].start, 1);
  assert.equal(good.lines[0].verse, 1);
  assert.equal(good.needsReview, false);
  const review = parseSyncJson(JSON.stringify({ syncMethod: 'estimated', needsReview: true, lines: [{ type: 'chorus', occurrence: 1, text: 'X', start: 1, end: 2 }] }));
  assert.equal(review.needsReview, true);
  assert.equal(review.syncMethod, 'estimated');
});

test('artefacto vocal real del himno 001 se alinea con su TXT', () => {
  const syncPath = 'data/sync/001 - Cantad alegres al Senor.sync.json';
  if (!existsSync(syncPath)) return; // Sin .sync.json no hay nada que comprobar.
  const sync = parseSyncJson(readFileSync(syncPath, 'utf8'));
  assert.ok(sync, 'el .sync.json debe parsear');
  assert.equal(sync.syncMethod, 'vocal-alignment');
  const structure = parseHymn(readFileSync('data/letras/001 - Cantad alegres al Senor.txt', 'utf8'));
  const timeline = timelineFromSync(structure, sync);
  assert.ok(timeline, 'debe coincidir con los fragmentos del TXT');
  assert.equal(timeline.length, 12);
  assert.equal(timeline[0].text, 'Cantad alegres al Señor,'); // el texto sale del TXT
  for (let i = 1; i < timeline.length; i++) {
    assert.ok(timeline[i].start >= timeline[i - 1].start, 'inicio no decreciente');
    assert.ok(timeline[i].end > timeline[i].start, 'fin mayor que inicio');
  }
  assert.ok(timeline[0].start > 5, 'el primer verso arranca tras la introducción');
});

test('colección completa: cada estrofa pasa al coro y luego a la siguiente', () => {
  const files = readdirSync('data/letras').filter(f => f.endsWith('.txt'));
  let choruses = 0;
  for (const file of files) {
    const text = readFileSync(`data/letras/${file}`, 'utf8');
    const structure = parseHymn(text);
    assert.ok(structure.sequence.length, file);
    assert.ok(splitLyricsIntoSlides(text).length, `Modo Letra: ${file}`);
    const timeline = estimateTimeline(structure, { energy: Array(1800).fill(1), step: 0.1, duration: 180 });
    assert.ok(timeline.length, file);
    for (let i = 0; i < structure.sequence.length; i++) {
      const first = timeline.findIndex(l => l.occurrence === i);
      assert.ok(first >= 0, file);
      assert.equal(findActiveIndex(timeline, timeline[first].start), first, file);
      if (first > 0) assert.equal(findActiveIndex(timeline, timeline[first].start - 0.0001), first - 1, file);
    }
    if (structure.chorus) {
      choruses++;
      assert.equal(structure.sequence.filter(s => s.type === 'chorus').length, Math.max(1, structure.verses.length), file);
    }
  }
  console.log(`${files.length} TXT verificados; ${choruses} con coro.`);
});
