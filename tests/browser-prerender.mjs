import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3300';
const catalog = JSON.parse(await readFile(new URL('../data/himnario-api.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
try {
  for (const number of [1, 2, 613]) {
    const hymn = catalog.find(h => h.number === number);
    const raw = await readFile(new URL(`../data${hymn.txtRoute}`, import.meta.url), 'utf8');
    const verses = raw.split(/\r?\n/).map(t => t.trim()).filter(t => t && !/^\d+$/.test(t) && !/^coro:?$/i.test(t));
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/data/himnario-api.json', async route => { await gate; await route.continue(); });
    const response = await page.goto(`${base}/${number}`, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    assert.ok(await page.locator('#static-hymn').isVisible(), 'lectura disponible durante la carga del catálogo');
    assert.ok((await page.locator('.static-lyrics').textContent()).includes(verses.at(-1)));
    release();
    await page.waitForFunction(() => !document.querySelector('#static-hymn'));
    assert.ok(await page.locator('#hymn-intro').isVisible());
    await page.waitForFunction(() => document.querySelector('audio').readyState > 0);
    // El DOM conserva el contenido completo durante la presentación inicial.
    let full = (await page.locator('#lyrics-list li').allTextContents()).join(' ');
    assert.ok(full.includes(verses[0]), 'primera línea en el DOM');
    assert.ok(full.includes(verses.at(-1)), 'última línea en el DOM');
    await page.evaluate(async number => {
      const { findHymn } = await import('/src/js/api/hymnsApi.js');
      const { getPlaybackLyrics } = await import('/src/js/services/lyricsService.js');
      const playback = await getPlaybackLyrics(await findHymn(number));
      const audio = document.querySelector('audio');
      audio.pause(); audio.currentTime = playback.lines[0].start + 0.1;
      audio.dispatchEvent(new Event('seeking'));
    }, number);
    await page.keyboard.press('l');
    assert.ok(await page.locator('#lyrics-list').isVisible(), 'lista disponible para el usuario con L');
    full = (await page.locator('#lyrics-list li').allTextContents()).join(' ');
    assert.ok(full.includes(verses.at(-1)));
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://himnario-adventista.pages.dev/${number}`);
    assert.deepEqual(errors, []);
    await context.close();
  }
  const failedContext = await browser.newContext();
  const failedPage = await failedContext.newPage();
  const errors = [];
  failedPage.on('pageerror', e => errors.push(e.message));
  await failedPage.route('**/data/himnario-api.json', route => route.abort('failed'));
  await failedPage.goto(`${base}/1`);
  assert.ok(await failedPage.locator('#static-hymn').isVisible(), 'fallo de catálogo conserva la letra');
  assert.ok((await failedPage.locator('.static-lyrics').textContent()).includes('él los ampara con su amor.'));
  assert.deepEqual(errors, []);
  await failedContext.close();
  console.log('Prerender: 1, 2 y 613 conservan letra durante carga/renderizado; lista L funcional; fallo de catálogo conserva lectura.');
} finally {
  await browser.close();
}
