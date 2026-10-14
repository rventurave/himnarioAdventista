import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
try {
  for (const number of [1, 8]) {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const audioRequests = [], errors = [];
    page.on('request', r => { if (/\.mp3(?:\?|$)/.test(r.url())) audioRequests.push(r.url()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.goto(`${base}/${number}?mode=lyrics`);
    await page.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
    const playback = await page.evaluate(async number => {
      const { findHymn } = await import('/src/js/api/hymnsApi.js');
      const { getPlaybackLyrics } = await import('/src/js/services/lyricsService.js');
      // Comparación con la misma línea de tiempo que utiliza Cantado.
      return getPlaybackLyrics(await findHymn(number));
    }, number);
    assert.ok(playback.lines.length);
    assert.equal(await page.locator('#hymn-audio').getAttribute('src'), null);
    let elapsed = 0;
    for (const [i, line] of playback.lines.entries()) {
      const target = Math.max(0, line.start - 1) + 0.12;
      await page.clock.runFor(Math.max(0, (target - elapsed) * 1000));
      elapsed = target;
      assert.ok((await page.locator('#lyric-current').textContent()).includes(line.text));
      assert.ok((await page.locator('#lyric-section').textContent()).startsWith(line.type === 'chorus' ? 'Coro' : `Estrofa ${line.verse}`));
      if (i === 0) {
        await page.keyboard.press('Space');
        await page.clock.runFor(10000);
        assert.ok((await page.locator('#lyric-current').textContent()).includes(line.text), 'pausa conserva el bloque');
        await page.keyboard.press('Space');
      }
    }
    await page.clock.runFor(Math.max(0, playback.lines.at(-1).end - 1 - elapsed + 1) * 1000);
    assert.equal(await page.locator('#lyric-current').textContent(), '', 'fin sin frase activa');
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    assert.ok((await page.locator('#lyric-current').textContent()).includes(playback.lines[0].text));
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#lyric-current').getAttribute('data-block-index'), '1');
    await page.keyboard.press('ArrowLeft');
    assert.ok((await page.locator('#lyric-current').textContent()).includes(playback.lines[0].text));
    await page.evaluate(async () => (await import('/src/js/core/router.js')).navigate('/'));
    const text = await page.locator('#lyric-current').textContent();
    await page.clock.runFor(30000);
    assert.equal(await page.locator('#lyric-current').textContent(), text, 'salir detiene el reloj');
    assert.deepEqual(audioRequests, [], 'Solo letra no descarga MP3');
    assert.deepEqual(errors, []);
    await page.close();
  }

  const fallback = await browser.newPage();
  const audioRequests = [];
  fallback.on('request', r => { if (/\.mp3(?:\?|$)/.test(r.url())) audioRequests.push(r.url()); });
  await fallback.route(/\.sync\.json(?:\?|$)|\.lrc(?:\?|$)/, r => r.fulfill({ status: 404, body: '' }));
  await fallback.goto(`${base}/1?mode=lyrics`);
  await fallback.waitForFunction(() => document.querySelector('#hymn-notice').textContent.includes('Usa las flechas'));
  await fallback.keyboard.press('ArrowRight');
  assert.ok((await fallback.locator('#lyric-current').textContent()).length);
  assert.deepEqual(audioRequests, [], 'sin sincronización tampoco descarga audio');
  await fallback.close();

  const stale = await browser.newPage();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await stale.route('**/data/letras/*.txt', async r => { await pending; await r.continue(); });
  const request = stale.waitForRequest('**/data/letras/*.txt');
  await stale.goto(`${base}/8?mode=lyrics`);
  await request;
  await stale.evaluate(async () => (await import('/src/js/core/router.js')).navigate('/'));
  const completed = stale.waitForEvent('requestfinished', { predicate: r => r.url().endsWith('.txt') });
  release();
  await completed;
  await stale.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  assert.ok(await stale.locator('#view-home').isVisible());
  assert.equal(await stale.locator('#hymn-nav').isVisible(), false);
  await stale.close();
  console.log('Solo letra: tiempos de Cantado, estrofas y coros, pausa, flechas, fin, salida, carga obsoleta y respaldo manual; sin descargas de audio.');
} finally {
  await browser.close();
}
