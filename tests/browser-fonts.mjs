import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3400';
const catalog = JSON.parse(await readFile(new URL('../data/himnario-api.json', import.meta.url), 'utf8'));
const longest = catalog.reduce((a, b) => a.title.length > b.title.length ? a : b).number;
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
async function loaded(page) {
  await page.evaluate(async () => {
    await Promise.all([document.fonts.load('400 24px "Bebas Neue"'), document.fonts.load('400 24px Nunito'), document.fonts.load('600 24px Nunito')]);
    await document.fonts.ready;
  });
  assert.ok(await page.evaluate(() => document.fonts.check('400 24px "Bebas Neue"')));
  assert.ok(await page.evaluate(() => document.fonts.check('600 24px Nunito')));
}
async function family(page, selector, expected, pseudo = null) {
  const value = await page.locator(selector).first().evaluate((el, pseudo) => getComputedStyle(el, pseudo).fontFamily, pseudo);
  assert.ok(value.includes(expected), `${selector}: ${value}`);
  const weight = await page.locator(selector).first().evaluate((el, pseudo) => getComputedStyle(el, pseudo).fontWeight, pseudo);
  assert.ok(['400', '600'].includes(weight), `${selector}: peso ${weight}`);
  if (expected === 'Bebas Neue') assert.equal(weight, '400');
  if (['#lyric-current', '#lyric-next', '.static-lyrics'].includes(selector)) assert.equal(weight, '600');
}
async function actualFont(page, selector, expected) {
  const session = await page.context().newCDPSession(page);
  await session.send('DOM.enable'); await session.send('CSS.enable');
  const { root } = await session.send('DOM.getDocument');
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
  assert.ok(fonts.some(font => font.isCustomFont && font.glyphCount > 0), `${selector}: ${JSON.stringify(fonts)}`);
  assert.ok(await page.evaluate(expected => Array.from(document.fonts).some(font => font.family.replaceAll('\"', '') === expected && font.status === 'loaded'), expected));
  await session.detach();
}
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Sin audio', 'NotAllowedError')); });
    await context.route('**/*.mp3', route => route.fulfill({ status: 404, body: '' }));
    const page = await context.newPage();
    const errors = [], fontFiles = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.resourceType() === 'font') fontFiles.push(r.url()); });
    await page.goto(base); await loaded(page);
    await family(page, '.app-title', 'Bebas Neue'); await actualFont(page, '.app-title', 'Bebas Neue');
    await family(page, 'body', 'Nunito'); await family(page, '#search-input', 'Nunito');
    await family(page, '#search-input', 'Nunito', '::placeholder');
    await family(page, '.selector-btn', 'Nunito'); await family(page, '.hymn-notfound-title', 'Bebas Neue'); await family(page, '.home-footer a', 'Nunito');
    assert.equal((await page.locator('link[href*="api.fontshare.com"]').count()), 0);
    assert.equal((await page.locator('link[href*="fonts.googleapis.com"]').count()), 1);
    assert.equal(fontFiles.length, new Set(fontFiles).size, 'sin solicitudes de fuentes duplicadas en portada');
    for (const number of [...new Set([1, 2, 613, longest])]) {
      await page.goto(`${base}/${number}?mode=lyrics`);
      await page.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
      await loaded(page);
      await family(page, '#intro-title', 'Bebas Neue'); await actualFont(page, '#intro-title', 'Bebas Neue');
      await page.evaluate(async number => {
        const { findHymn } = await import('/src/js/api/hymnsApi.js');
        const { getPlaybackLyrics } = await import('/src/js/services/lyricsService.js');
        const mode = await import('/src/js/components/hymn/lyricsMode.js');
        mode.seekBy((await getPlaybackLyrics(await findHymn(number))).lines[0].start);
      }, number);
      await page.waitForFunction(() => !document.querySelector('#lyrics-stage').hidden);
      await family(page, '#hymn-title', 'Bebas Neue');
      for (const selector of ['#hymn-reference', '#lyric-current', '#lyric-next', '#hymn-counter', '#hymn-back']) await family(page, selector, 'Nunito');
      await actualFont(page, '#lyric-current', 'Nunito');
      await family(page, '#lyric-section', 'Bebas Neue');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `desbordamiento ${number} en ${viewport.width}`);
      await page.reload(); await loaded(page);
      await family(page, '#intro-title', 'Bebas Neue');
      await family(page, '#hymn-reference', 'Nunito');
    }
    await page.evaluate(async () => { (await import('/src/js/core/router.js')).navigate('/1?mode=karaoke'); });
    await page.waitForFunction(() => !document.querySelector('#lyrics-list').hidden);
    await loaded(page);
    await family(page, '#lyrics-list', 'Nunito'); await family(page, '#hymn-notice', 'Nunito');
    await family(page, '#hymn-title', 'Bebas Neue');
    await page.evaluate(async () => { (await import('/src/js/core/router.js')).navigate('/613?mode=sung'); });
    await page.waitForFunction(() => document.querySelector('#hymn-title').textContent === 'Hoy nos toca trabajar' && !document.querySelector('#lyrics-list').hidden);
    await family(page, '#lyrics-list', 'Nunito');
    await page.goto(`${base}/himnos`); await loaded(page);
    await family(page, 'h1', 'Bebas Neue'); await actualFont(page, 'h1', 'Bebas Neue');
    await family(page, 'ol a', 'Nunito'); assert.equal(await page.locator('ol a').count(), 613);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    if (viewport.width === 390) { await page.goto(base); await loaded(page); await page.screenshot({ path: '/tmp/hymn-fonts-mobile.png' }); }
    await context.close();
  }
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const p = await plain.newPage(); await p.goto(`${base}/1`); await loaded(p);
  await family(p, '#static-hymn h1', 'Bebas Neue'); await family(p, '#static-hymn h2', 'Bebas Neue');
  await family(p, '.static-lyrics', 'Nunito'); await actualFont(p, '.static-lyrics', 'Nunito');
  await plain.close();
  const errorPage = await browser.newPage();
  await errorPage.goto(`${base}/404.html`);
  await errorPage.evaluate(() => document.fonts.ready);
  await family(errorPage, 'body', 'Nunito'); await actualFont(errorPage, 'body', 'Nunito');
  await errorPage.close();
  console.log('Fuentes reales Bebas Neue/Nunito verificadas en escritorio y móvil; portada, índice, himnos, navegación, recarga y sin JavaScript; sin desbordamiento.');
} finally { await browser.close(); }
