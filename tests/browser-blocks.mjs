import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { parseHymn, expandHymn } from '../src/js/utils/hymnParser.js';
import { timelineFromSync } from '../src/js/utils/lyricsTimeline.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3400';
const catalog = JSON.parse(await readFile(new URL('../data/himnario-api.json', import.meta.url), 'utf8'));
const corpus = await Promise.all(catalog.map(async hymn => {
  const text = await readFile(new URL(`../data${hymn.txtRoute}`, import.meta.url), 'utf8');
  const structure = parseHymn(text);
  const sync = JSON.parse(await readFile(new URL(`../data/sync/${hymn.txtRoute.split('/').at(-1).replace(/\.txt$/, '.sync.json')}`, import.meta.url), 'utf8'));
  const saved = timelineFromSync(structure, sync);
  // Solo para probar la asociación visual de datos que el motor real descarta.
  const timeline = saved || expandHymn(structure).map((line, i) => ({ ...line, start: i * 2, end: i * 2 + 1 }));
  return { hymn, structure, timeline, hasValidSync: !!saved };
}));
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
const report = { viewports: [], invalidSavedSync: corpus.filter(h => !h.hasValidSync).map(h => h.hymn.number) };
try {
  const context = await browser.newContext();
  await context.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Sin sonido', 'NotAllowedError')); });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/1?mode=lyrics`);
  await page.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
  await page.evaluate(async () => { (await import('/src/js/components/hymn/lyricsMode.js')).stop(); await document.fonts.ready; });
  for (const viewport of [[320,568],[375,667],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1920,1080],[2560,1440],[844,390],[390,320]].map(([width,height]) => ({width,height}))) {
    await page.setViewportSize(viewport);
    const result = await page.evaluate(async corpus => {
      const view = await import('/src/js/components/hymn/hymnView.js');
      view.showStage(true); view.showTopbar(true); view.showNav(true); view.clearNotice();
      const report = { hymns: 0, blocks: 0, splitBeyondTwo: [], scroll: [], errors: [] };
      for (const { hymn, structure, timeline } of corpus) {
        view.renderHeader(hymn);
        view.prepareBlocks(structure, timeline);
        const blocks = view.getBlocks();
        const reference = structure.sequence.flatMap(s => (s.type === 'chorus' ? structure.chorus : structure.verses.find(v => v.number === s.number)).lines);
        const actual = blocks.flatMap(b => b.rows.map(r => r.text));
        if (JSON.stringify(actual) !== JSON.stringify(reference)) report.errors.push(`texto ${hymn.number}`);
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i]; view.renderBlock(i, true);
          const element = document.querySelector('#lyric-current');
          const stage = document.querySelector('#lyrics-stage');
          const rect = stage.getBoundingClientRect();
          if (element.scrollHeight > element.clientHeight + 2 && !b.scroll) report.errors.push(`recorte ${hymn.number}:${b.occurrence}:${b.part}`);
          if (rect.bottom > innerHeight + 2 || rect.top < 0) report.errors.push(`fuera de pantalla ${hymn.number}`);
          if (b.exceptional && b.part === 1) report.splitBeyondTwo.push({ number: hymn.number, occurrence: b.occurrence, parts: b.parts });
          if (b.scroll) report.scroll.push({ number: hymn.number, occurrence: b.occurrence, part: b.part });
        }
        report.hymns++; report.blocks += blocks.length;
      }
      return report;
    }, corpus);
    assert.equal(result.errors.length, 0, `${viewport.width}×${viewport.height}: ${result.errors.slice(0, 10)}`);
    report.viewports.push({ ...viewport, ...result });
    console.log(`Geometría ${viewport.width}×${viewport.height}: ${result.hymns} himnos, ${result.blocks} bloques, ${result.splitBeyondTwo.length} secciones >2 partes, ${result.scroll.length} bloques con scroll.`);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(100);
  await page.evaluate(async data => {
    const v = await import('/src/js/components/hymn/hymnView.js');
    v.renderHeader(data.hymn); v.prepareBlocks(data.structure, data.timeline); v.renderBlock(0, true);
  }, corpus[0]);
  await page.waitForTimeout(100);
  const out = await page.evaluate(async () => { (await import('/src/js/components/hymn/hymnView.js')).renderBlock(1); return document.querySelector('#lyric-current').getAnimations()[0]?.effect.getKeyframes(); });
  assert.ok(out.at(-1).transform.includes('-110%'), 'sale hacia la izquierda');
  await page.waitForTimeout(450);
  assert.equal(await page.locator('#lyric-current').getAttribute('data-block-index'), '1');
  await page.evaluate(async () => (await import('/src/js/components/hymn/hymnView.js')).renderBlock(0));
  const back = await page.locator('#lyric-current').evaluate(e => e.getAnimations()[0]?.effect.getKeyframes());
  assert.ok(back.at(-1).transform.includes('110%') && !back.at(-1).transform.includes('-110%'));
  await page.evaluate(async () => { const v = await import('/src/js/components/hymn/hymnView.js'); for (const i of [1, 2, 1, 2, 0]) v.renderBlock(i); });
  await page.waitForTimeout(850);
  assert.equal(await page.locator('#lyric-current').getAttribute('data-block-index'), '0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => (await import('/src/js/components/hymn/hymnView.js')).renderBlock(2));
  assert.equal(await page.locator('#lyric-current').getAttribute('data-block-index'), '2');
  assert.equal(await page.locator('#lyric-current').evaluate(e => e.getAnimations().length), 0);
  await page.evaluate(async () => (await import('/src/js/components/hymn/hymnView.js')).renderTimedBlock(2));
  const source = await page.locator('#lyric-current .active').getAttribute('data-row');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#lyric-current .active').getAttribute('data-row'), source, 'resize conserva verso actual');
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(100);
  assert.equal(await page.locator('#lyric-current .active').getAttribute('data-row'), source);
  assert.deepEqual(errors, []);
  await context.close();

  // Integración real con el reloj del audio, pausado: no modifica los tiempos.
  const playbackContext = await browser.newContext();
  await playbackContext.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Sin sonido', 'NotAllowedError')); });
  const live = await playbackContext.newPage();
  const liveErrors = []; live.on('pageerror', e => liveErrors.push(e.message));
  for (const number of [1, 2, 8, 613]) for (const mode of ['sung', 'karaoke']) {
    await live.goto(`${base}/${number}?mode=${mode}`);
    await live.waitForFunction(() => document.querySelector('audio').readyState > 0 && !document.querySelector('#hymn-start').hidden);
    // Entra en la vista de contenido (barra superior visible) antes de medir los
    // bloques: la distribución depende del alto disponible y debe ser la misma
    // que se usa durante la reproducción.
    await live.evaluate(async number => {
      const { findHymn } = await import('/src/js/api/hymnsApi.js');
      const { getPlaybackLyrics } = await import('/src/js/services/lyricsService.js');
      const timeline = (await getPlaybackLyrics(await findHymn(number))).lines;
      const audio = document.querySelector('audio');
      audio.currentTime = Math.max(0, timeline[0].start - 1 + 0.01);
      audio.dispatchEvent(new Event('seeking'));
    }, number);
    await live.waitForFunction(() => !document.querySelector('#hymn-topbar').hidden);
    await live.waitForTimeout(150);
    const result = await live.evaluate(async number => {
      const { findHymn } = await import('/src/js/api/hymnsApi.js');
      const { getPlaybackLyrics } = await import('/src/js/services/lyricsService.js');
      const view = await import('/src/js/components/hymn/hymnView.js');
      const timeline = await getPlaybackLyrics(await findHymn(number));
      return { timeline: timeline.lines, blocks: view.getBlocks().map(b => ({ id: b.id, firstCue: b.firstCue })) };
    }, number);
    const fullBefore = await live.locator('#lyrics-list').textContent();
    for (const block of [...result.blocks, ...result.blocks.toReversed()]) {
      if (block.firstCue === null) continue;
      const line = result.timeline[block.firstCue];
      await live.evaluate(time => { const a = document.querySelector('audio'); a.currentTime = time; a.dispatchEvent(new Event('seeking')); }, Math.max(0, line.start - 1 + 0.01));
      await live.waitForFunction(id => document.querySelector('#lyric-current').dataset.block === id, block.id);
      assert.ok(await live.locator('#lyric-current .active').count(), 'verso resaltado');
      assert.equal(await live.locator('#lyrics-list').textContent(), fullBefore, 'DOM completo no cambia al animar');
    }
    await live.keyboard.press('l'); assert.ok(await live.locator('#lyrics-list').isVisible());
    await live.keyboard.press('l'); assert.ok(await live.locator('#lyrics-stage').isVisible());
    await live.reload(); await live.waitForFunction(() => document.querySelector('audio').readyState > 0);
  }
  await playbackContext.close();
  // Letra con reloj virtual y navegación por bloques, con/sin tiempos.
  for (const manual of [false, true]) {
    const ctx = await browser.newContext(); const p = await ctx.newPage(); const mp3 = [];
    p.on('request', r => { if (r.url().endsWith('.mp3')) mp3.push(r.url()); });
    if (manual) await p.route(/\.sync\.json(?:\?|$)|\.lrc(?:\?|$)/, r => r.fulfill({ status: 404, body: '' }));
    await p.goto(`${base}/1?mode=lyrics`); await p.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
    const current = p.locator('#lyric-current');
    if (manual) {
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(450);
      const first = await current.getAttribute('data-block');
      const full = await p.locator('#lyrics-list').textContent();
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(450);
      assert.notEqual(await current.getAttribute('data-block'), first);
      await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(450);
      assert.equal(await current.getAttribute('data-block'), first);
      assert.equal(await p.locator('#lyrics-list').textContent(), full);
    } else {
      // Con tiempos, las flechas no saltan de bloque: mueven el reloj virtual 1 s.
      await p.keyboard.press('Space');
      await p.evaluate(async () => (await import('/src/js/components/hymn/lyricsMode.js')).seekBy(27));
      await p.waitForTimeout(450);
      const first = await current.getAttribute('data-block');
      const full = await p.locator('#lyrics-list').textContent();
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(450);
      assert.equal(await current.getAttribute('data-block'), first, 'la flecha no cambia de bloque');
      await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(450);
      assert.equal(await current.getAttribute('data-block'), first);
      assert.equal(await p.locator('#lyrics-list').textContent(), full);
    }
    assert.deepEqual(mp3, []);
    await ctx.close();
  }
  if (process.env.BLOCK_REPORT) await writeFile(process.env.BLOCK_REPORT, JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(liveErrors, []);
  console.log('Bloques: animación bidireccional, cambios rápidos, resize/orientación, reduced-motion, letra, cantado, karaoke, recarga y DOM completo correctos.');
} finally { await browser.close(); }
