import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  const errors = [], audioRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('.mp3')) audioRequests.push(request.url());
  });
  await page.goto(base);
  await page.locator('#search-input').fill('1');
  await page.locator('#search-form').evaluate(form => form.requestSubmit());
  await page.waitForURL('**/1?mode=sung');
  await page.waitForFunction(() => {
    const audio = document.querySelector('#hymn-audio');
    return audio.readyState > 0 && !audio.paused;
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#hymn-audio').paused);
  const before = await page.locator('#hymn-audio').evaluate(a => a.currentTime);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(time => Math.abs(document.querySelector('#hymn-audio').currentTime - time - 5) < 0.1, before);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !document.querySelector('#hymn-audio').paused);
  await page.evaluate(async () => {
    const { navigate } = await import('/src/js/core/router.js');
    navigate('/186?mode=karaoke');
  });
  await page.waitForFunction(() => {
    const a = document.querySelector('#hymn-audio');
    return a.currentSrc.includes('/instrumentales/186') && a.readyState > 0 && !a.paused;
  });
  const result = await page.evaluate(async () => {
    const { findHymn } = await import('/src/js/api/hymnsApi.js');
    const { getPlaybackLyrics } = await import('/src/js/services/lyricsService.js');
    const timeline = await getPlaybackLyrics(await findHymn(186));
    const line = timeline.lines[4];
    const a = document.querySelector('#hymn-audio');
    a.pause(); a.currentTime = line.start - 1 + 0.01;
    a.dispatchEvent(new Event('seeking'));
    return line.text;
  });
  await page.waitForFunction(text => document.querySelector('#lyric-current').textContent === text, result);
  assert.ok(audioRequests.every(url => url.startsWith('https://pub-1ca54579e235492c815179e37558122a.r2.dev/data/audios/')));
  assert.ok(audioRequests.every(url => /\/(001|186)%20/.test(url)), 'solo audios seleccionados');
  // Respuesta 404 simulada: comprueba la UI de error, no la existencia remota.
  await page.route('**/data/audios/**', route => route.fulfill({ status: 404, body: '' }));
  await page.evaluate(async () => {
    const { navigate } = await import('/src/js/core/router.js');
    navigate('/2?mode=sung');
  });
  await page.waitForFunction(() => document.querySelector('#hymn-notice').textContent.includes('No se pudo reproducir'));
  await page.waitForFunction(() => !document.querySelector('#lyrics-list').hidden);
  assert.ok((await page.locator('#lyrics-list').textContent()).length);
  await page.unroute('**/data/audios/**');
  await page.route('**/data/audios/**', route => route.abort('failed'));
  await page.evaluate(async () => {
    const { navigate } = await import('/src/js/core/router.js');
    navigate('/3?mode=karaoke');
  });
  await page.waitForFunction(() => document.querySelector('#hymn-notice').textContent.includes('No se pudo reproducir'));
  await page.waitForFunction(() => !document.querySelector('#lyrics-list').hidden);
  assert.deepEqual(errors, []);
  console.log('R2 real: buscador, controles, cambio de himno/modo y sincronización; 404 y fallo de red simulados: aviso y letra completa.');
} finally {
  await browser.close();
}
