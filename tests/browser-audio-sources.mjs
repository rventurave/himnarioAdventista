import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { getHymnAudioUrl, getConfig } from '../src/js/api/hymnsApi.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'https://himnario-adventista.pages.dev';
const catalog = JSON.parse(await readFile(new URL('../data/himnario-api.json', import.meta.url), 'utf8'));
const samples = [1, 100, 300, 613].map(number => catalog.find(h => h.number === number));
const audioBase = getConfig().audioBaseUrl;
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const report = { base, playback: [], lyricsWithoutAudio: [], cors: [] };
try {
  for (const hymn of samples) {
    for (const mode of ['sung', 'karaoke']) {
      const page = await browser.newPage();
      const requests = [], errors = [];
      page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.mp3')) requests.push(request.url()); });
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/${hymn.number}?mode=${mode}`);
      await page.waitForFunction(() => { const a = document.querySelector('audio'); return a.readyState >= 2 && !a.paused && a.currentTime > 0.25; });
      const expected = getHymnAudioUrl(hymn, mode);
      const audio = page.locator('audio');
      assert.equal(await audio.evaluate(a => a.currentSrc), expected);
      await audio.evaluate(a => a.pause());
      await page.keyboard.press('ArrowRight');
      assert.ok(await audio.evaluate(a => a.currentTime >= 5), 'seek real');
      assert.ok(requests.length && requests.every(url => url.startsWith(audioBase)), 'todos los MP3 van a R2');
      assert.ok(requests.every(url => [expected, getHymnAudioUrl(hymn, 'sung')].includes(url)), 'solo audio seleccionado o referencia de análisis');
      assert.deepEqual(errors, []);
      const result = { number: hymn.number, mode, url: expected, duration: await audio.evaluate(a => a.duration), requests: requests.length };
      report.playback.push(result);
      console.log(JSON.stringify(result));
      await page.close();
    }
    const page = await browser.newPage();
    const mp3 = [];
    page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.mp3')) mp3.push(request.url()); });
    // Fuerza el respaldo sin tiempos: lyrics tampoco debe analizar un MP3.
    await page.route('**/data/sync/**', route => route.fulfill({ status: 404, body: '' }));
    await page.route('**/*.lrc', route => route.fulfill({ status: 404, body: '' }));
    await page.goto(`${base}/${hymn.number}?mode=lyrics`);
    await page.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
    await page.keyboard.press('ArrowRight');
    assert.ok((await page.locator('#lyric-current').textContent()).length);
    assert.equal(await page.locator('audio').getAttribute('src'), null);
    assert.deepEqual(mp3, [], 'modo lyrics sin tiempos tampoco solicita MP3');
    report.lyricsWithoutAudio.push(hymn.number);
    for (const mode of ['sung', 'karaoke']) {
      const url = getHymnAudioUrl(hymn, mode);
      const result = await page.evaluate(async url => {
        try {
          const response = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(15000) });
          if (response.status !== 206) { await response.body?.cancel(); return { ok: false, status: response.status }; }
          return { ok: true, status: response.status, bytes: (await response.arrayBuffer()).byteLength };
        } catch (e) { return { ok: false, error: `${e.name}: ${e.message}` }; }
      }, url);
      report.cors.push({ number: hymn.number, mode, url, ...result });
    }
    await page.close();
  }
  console.log(`Reproducción y seek R2: ${report.playback.length}/8. Lyrics sin MP3: ${report.lyricsWithoutAudio.length}/4. Fetch CORS permitido: ${report.cors.filter(r => r.ok).length}/8.`);
  if (process.env.AUDIO_REPORT) await writeFile(process.env.AUDIO_REPORT, JSON.stringify(report, null, 2) + '\n');
  if (process.env.REQUIRE_CORS === '1') assert.ok(report.cors.every(r => r.ok), 'CORS debe permitir las 8 URL');
} finally {
  await browser.close();
}
