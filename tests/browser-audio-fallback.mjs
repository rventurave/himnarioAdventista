import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3300';
const catalog = JSON.parse(await readFile(new URL('../data/himnario-api.json', import.meta.url), 'utf8'));
const normalize = text => text.replace(/\s+/g, ' ').trim();
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
const expected = new Map(await Promise.all(catalog.map(async hymn => {
  const text = await readFile(new URL(`../data${hymn.txtRoute}`, import.meta.url), 'utf8');
  return [hymn.number, text.split(/\r?\n/).map(normalize).filter(t => t && !/^\d+$/.test(t) && !/^coro:?$/i.test(t))];
})));
async function contextFor(error = 'NotAllowedError') {
  const context = await browser.newContext();
  await context.addInitScript(error => {
    window.testPlaying = 0;
    document.addEventListener('playing', () => window.testPlaying++, true);
    HTMLMediaElement.prototype.play = function () {
      return Promise.reject(new DOMException('Prueba sin reproducción', error));
    };
  }, error);
  return context;
}
async function assertLyrics(page, hymn, visible = true) {
  if (visible) assert.ok(await page.locator('#lyrics-list').isVisible());
  const full = normalize((await page.locator('#lyrics-list li').allTextContents()).join(' '));
  for (const line of expected.get(hymn.number)) assert.ok(full.includes(line), `${hymn.number}: falta ${line}`);
  assert.equal(await page.locator('#hymn-title').textContent(), hymn.title);
  assert.equal(await page.locator('#hymn-reference').textContent(), hymn.bibleReference || '');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://himnario-adventista.pages.dev/${hymn.number}`);
  assert.equal(await page.evaluate(() => window.testPlaying), 0);
}
try {
  for (const scenario of ['autoplay-blocked', 'late-intro', 'late-content', 'karaoke-late', '404', 'network', 'audio-and-text']) {
    const context = await contextFor(['late-intro', 'karaoke-late'].includes(scenario) ? 'NotSupportedError' : 'NotAllowedError');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (['404', 'network', 'audio-and-text'].includes(scenario)) {
      await page.route('**/*.mp3', route => scenario === 'network' ? route.abort('failed') : route.fulfill({ status: 404, body: '' }));
    }
    if (scenario === 'audio-and-text') {
      await page.route('**/data/letras/**', route => route.abort('failed'));
      await page.route('**/data/sync/**', route => route.abort('failed'));
    }
    await page.goto(`${base}/1${scenario === 'karaoke-late' ? '?mode=karaoke' : ''}`);
    if (scenario === 'autoplay-blocked' || scenario === 'late-content') {
      await page.waitForFunction(() => !document.querySelector('#hymn-start').hidden);
      await assertLyrics(page, catalog[0], false);
    }
    if (scenario === 'late-content') {
      await page.waitForFunction(() => document.querySelector('audio').readyState > 0);
      await page.evaluate(async () => {
        const { findHymn } = await import('/src/js/api/hymnsApi.js');
        const { getPlaybackLyrics } = await import('/src/js/services/lyricsService.js');
        const playback = await getPlaybackLyrics(await findHymn(1));
        const audio = document.querySelector('audio');
        audio.currentTime = playback.lines[0].start + 0.1;
        audio.dispatchEvent(new Event('seeking'));
      });
      await page.waitForFunction(() => !document.querySelector('#lyrics-stage').hidden);
      await page.keyboard.press('l');
      assert.ok(await page.locator('#lyrics-list').isVisible());
      await page.keyboard.press('l');
      // Ocultar la lista no debe borrar las estrofas.
      await assertLyrics(page, catalog[0], false);
      await page.evaluate(() => {
        const audio = document.querySelector('audio');
        Object.defineProperty(audio, 'error', { value: { code: 2 }, configurable: true });
        audio.dispatchEvent(new Event('error'));
      });
    }
    if (scenario !== 'autoplay-blocked') {
      await page.waitForFunction(() => document.querySelector('#hymn-notice').textContent.includes('No se pudo reproducir') && !document.querySelector('#lyrics-list').hidden);
      await assertLyrics(page, catalog[0]);
      assert.ok(await page.locator('#hymn-topbar').isVisible());
    }
    assert.deepEqual(errors, []);
    console.log(`Audio sin reproducción: ${scenario}, letra conservada.`);
    await context.close();
  }
  // Los 613 himnos siguen siendo legibles si el MP3 falla; sin reproducir audio.
  const context = await contextFor();
  await context.route('**/*.mp3', route => route.fulfill({ status: 404, body: '' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  const selected = process.env.TEST_HYMNS ? catalog.filter(h => process.env.TEST_HYMNS.split(',').map(Number).includes(h.number)) : catalog;
  for (const hymn of selected) {
    await page.evaluate(async number => {
      const { navigate } = await import('/src/js/core/router.js');
      navigate(`/${number}?mode=sung`);
    }, hymn.number);
    await page.waitForFunction(title => document.querySelector('#hymn-title').textContent === title && !document.querySelector('#lyrics-list').hidden, hymn.title);
    await assertLyrics(page, hymn);
  }
  assert.deepEqual(errors, []);
  await context.close();
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const pagePlain = await plain.newPage();
  for (const number of [1, 2, 613]) {
    await pagePlain.goto(`${base}/${number}`);
    assert.ok(await pagePlain.locator('#static-hymn').isVisible());
    const full = normalize(await pagePlain.locator('.static-lyrics').textContent());
    for (const line of expected.get(number)) assert.ok(full.includes(line));
  }
  await plain.close();
  console.log(`${selected.length} himnos con fallo de audio y lectura sin JavaScript correctos; ningún evento playing.`);
} finally {
  await browser.close();
}
