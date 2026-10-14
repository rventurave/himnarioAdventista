import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3300';
const catalog = JSON.parse(await readFile(new URL('../data/himnario-api.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.testPlaying = 0;
    document.addEventListener('playing', () => window.testPlaying++, true);
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Prueba sin audio', 'NotAllowedError'));
  });
  await context.route('**/*.mp3', route => route.fulfill({ status: 404, body: '' }));
  let checks = 0;
  for (const number of [1, 2, 613]) {
    const hymn = catalog.find(h => h.number === number);
    const raw = await readFile(new URL(`../data${hymn.txtRoute}`, import.meta.url), 'utf8');
    const last = raw.trim().split(/\r?\n/).at(-1).trim();
    const paths = ['', '?mode=sung', '?mode=lyrics', '?mode=karaoke', '?mode=', '?mode=invalido'].map(search => [`/${number}${search}`, `/${number}${search}`]);
    if (process.env.TEST_LEGACY_ROUTES !== '0') paths.push([`/_hymns/${number}`, `/${number}`], [`/_hymns/${number}?mode=karaoke`, `/${number}?mode=karaoke`]);
    for (const [path, normalized] of paths) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      for (const action of ['directa', 'recarga']) {
        const response = action === 'directa' ? await page.goto(base + path) : await page.reload();
        assert.equal(response.status(), 200, `${path}, ${action}`);
        await page.waitForFunction(title => !document.querySelector('#view-hymn').hidden && document.querySelector('#hymn-title').textContent === title, hymn.title);
        assert.equal(await page.locator('#view-home').isVisible(), false);
        const mode = new URL(page.url()).searchParams.get('mode');
        const expected = ['lyrics', 'sung', 'karaoke'].includes(mode) ? mode : 'sung';
        const actual = await page.evaluate(async () => (await import('/src/js/components/hymn/hymnController.js')).getCurrentMode());
        assert.equal(actual, expected);
        assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, normalized);
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://himnario-adventista.pages.dev/${number}`);
        if (expected !== 'lyrics') {
          await page.waitForFunction(() => !document.querySelector('#lyrics-list').hidden);
          assert.ok((await page.locator('#lyrics-list li').allTextContents()).join(' ').includes(last), 'letra completa pese al fallo de audio');
          const src = await page.locator('audio').getAttribute('src');
          assert.ok(src.includes(expected === 'karaoke' ? '/instrumentales/' : '/cantadas/'));
        } else {
          await page.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
          assert.equal(await page.locator('audio').getAttribute('src'), null);
          await page.keyboard.press('ArrowRight');
          assert.ok((await page.locator('#lyric-current').textContent()).length);
        }
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => window.testPlaying), 0);
        checks++;
      }
      await page.close();
    }
  }
  await context.close();
  console.log(`Rutas: ${checks} cargas/recargas correctas; 1, 2 y 613, modos reales y fallback; sin reproducción.`);
} finally {
  await browser.close();
}
