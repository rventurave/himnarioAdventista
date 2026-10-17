import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHymn, expandHymn } from '../src/js/utils/hymnParser.js';
import { createVisualSections, groupVisualSections, blockForCue, wordCount } from '../src/js/utils/lyricBlocks.js';
import { timelineFromSync } from '../src/js/utils/lyricsTimeline.js';
const example = ['Traían en silencio presentes al Señor;', 'su amor humilde y puro les daba gran valor;', 'palabras de consuelo y hechos de bondad,', 'Jesús los recibía por su sinceridad.'];
const model = text => createVisualSections(parseHymn(text));
const originalRows = m => m.sections.flatMap(s => s.rows);
test('solo el himno 31 divide su estrofa en dos presentaciones de cuatro líneas', () => {
  const structure = parseHymn(readFileSync('data/letras/031 - Oh, Senor al orar.txt', 'utf8'));
  for (const hymnNumber of [31, 32]) {
    const m = createVisualSections({ ...structure, hymnNumber }, expandHymn(structure));
    const blocks = groupVisualSections(m.sections, () => true);
    assert.deepEqual(blocks.map(b => b.rows.length), hymnNumber === 31 ? [4, 4] : [8]);
    preserve(m, blocks);
    if (hymnNumber === 31) {
      assert.equal(blocks[0].rows.at(-1).text, 'y tu bendición alcanzar.');
      assert.equal(blocks[1].rows[0].text, 'Hoy mi vida transforma, Señor;');
      assert.deepEqual(blocks.map(b => [b.verse, b.part, b.parts]), [[1, 1, 2], [1, 2, 2]]);
      assert.equal(blockForCue(blocks, 4), 1);
    }
  }
});
function preserve(m, blocks) {
  assert.deepEqual(blocks.flatMap(b => b.rows), originalRows(m));
  for (const b of blocks) assert.ok(b.rows.every(r => m.sections[b.occurrence].rows.includes(r)));
}
test('ejemplo exacto: estrofa entera si cabe, división 2 + 2 si hace falta', () => {
  const m = model('1\n' + example.join('\n'));
  const full = groupVisualSections(m.sections, () => true);
  assert.equal(full.length, 1); assert.ok(wordCount(example.join(' ')) > 20); preserve(m, full);
  const split = groupVisualSections(m.sections, lines => lines.length <= 2);
  assert.deepEqual(split.map(b => b.rows.map(r => r.text)), [example.slice(0, 2), example.slice(2)]); preserve(m, split);
});
test('2, 3, 4, 6 y más versos; cortos, 15–20 palabras y puntuación irregular', () => {
  for (const n of [2, 3, 4, 6, 9, 15]) {
    const m = model('1\n' + Array.from({ length: n }, (_, i) => `Verso ${i} con sus palabras${[';', ':', ',', '.', ''][i % 5]}`).join('\n'));
    for (const limit of [2, 3, n]) {
      const blocks = groupVisualSections(m.sections, lines => lines.length <= limit); preserve(m, blocks);
      if (limit === n) assert.equal(blocks.length, 1);
      assert.ok(blocks.every(b => b.rows.length <= limit));
    }
  }
  for (const text of ['Canta al Señor.\nCon amor.', 'Una primera línea con ocho palabras muy claras;\nOtra segunda línea con ocho palabras muy claras.']) {
    const m = model('1\n' + text); assert.equal(groupVisualSections(m.sections, () => true).length, 1);
  }
});
test('cantidad impar equilibrada y pausa natural al elegir el corte', () => {
  const m = model('1\nUno dos tres cuatro cinco\nUno dos tres cuatro cinco,\nUno dos tres cuatro cinco;\nUno dos tres cuatro cinco\nUno dos tres cuatro cinco.');
  const blocks = groupVisualSections(m.sections, rows => rows.length <= 3);
  assert.deepEqual(blocks.map(b => b.rows.length), [3, 2]);
  preserve(m, blocks);
});
test('alternativa segura: más partes o scroll para un verso indivisible', () => {
  const m = model('1\n' + Array.from({ length: 9 }, (_, i) => `Línea completa ${i}.`).join('\n'));
  const blocks = groupVisualSections(m.sections, lines => lines.length <= 2);
  assert.equal(blocks.length, 5); assert.ok(blocks.every(b => b.exceptional)); preserve(m, blocks);
  const single = model('1\nUn verso largo que no cabe sin desplazamiento.');
  const overflow = groupVisualSections(single.sections, () => false);
  assert.equal(overflow.length, 1); assert.equal(overflow[0].scroll, true); preserve(single, overflow);
});
test('coros repetidos, cues que subdividen versos y LRC que atraviesa versos', () => {
  const structure = parseHymn('1\nPrimera frase; segunda frase.\nOtro verso.\nCoro:\nCoro completo.\n2\nFinal.');
  const timeline = expandHymn(structure).map((line, i) => ({ ...line, start: i * 3, end: i * 3 + 2 }));
  const before = JSON.stringify(timeline);
  const m = createVisualSections(structure, timeline); assert.equal(m.aligned, true);
  const blocks = groupVisualSections(m.sections, () => true); preserve(m, blocks);
  for (let i = 0; i < timeline.length; i++) assert.equal(blocks[blockForCue(blocks, i)].occurrence, timeline[i].occurrence);
  assert.equal(JSON.stringify(timeline), before);
  const spanning = createVisualSections(parseHymn('1\nUn verso.\nOtro verso.'), [{ text: 'Un verso. Otro verso.', start: 0, end: 10 }]);
  assert.ok(spanning.sections[0].rows.every(r => r.cues.includes(0)));
});
test('613 TXT y tiempos: sin versos perdidos, duplicados o desordenados', () => {
  const catalog = JSON.parse(readFileSync('data/himnario-api.json', 'utf8'));
  let timed = 0;
  for (const hymn of catalog) {
    const raw = readFileSync('data' + hymn.txtRoute, 'utf8');
    const structure = parseHymn(raw);
    const rawLines = raw.replace(/\uFEFF/g, '').split(/\r\n?|\n/).map(s => s.trim()).filter(s => s && !/^(?:estrofa\s+)?\d+\s*[.):º°-]?$/i.test(s) && !/^(?:coro|estribillo)\s*[:.：-]?$/i.test(s));
    const parsedLines = [...structure.verses.flatMap(v => v.lines), ...(structure.chorus?.lines || [])];
    assert.deepEqual([...parsedLines].sort(), [...rawLines].sort(), `versos TXT íntegros ${hymn.number}`);
    const sync = JSON.parse(readFileSync('data/sync/' + hymn.txtRoute.split('/').at(-1).replace(/\.txt$/, '.sync.json'), 'utf8'));
    const saved = timelineFromSync(structure, sync);
    // Datos existentes que el motor ya descarta: valida el texto con cues de prueba,
    // sin guardar ni atribuir tiempos nuevos a esos himnos.
    const timeline = saved || expandHymn(structure).map((line, i) => ({ ...line, start: i * 2, end: i * 2 + 1 }));
    const m = createVisualSections(structure, timeline);
    assert.ok(m.aligned, `alineación textual ${hymn.number}`);
    for (const limit of [1, 2, 3, 4, 6, 15]) {
      const measured = groupVisualSections(m.sections, lines => lines.length <= limit);
      preserve(m, measured);
      if (saved) for (const [i, block] of measured.entries()) assert.equal(blockForCue(measured, block.firstCue), i, `inicio del bloque ${hymn.number}`);
    }
    const blocks = groupVisualSections(m.sections, () => true);
    for (let i = 0; i < timeline.length; i++) {
      const b = blocks[blockForCue(blocks, i)];
      assert.ok(b, `${hymn.number}, cue ${i}`);
      assert.equal(b.occurrence, timeline[i].occurrence);
    }
    if (saved) timed++;
  }
  console.log(`${catalog.length} TXT y ${timed} sincronizaciones existentes aceptadas; grupos validados con seis capacidades de pantalla.`);
});
