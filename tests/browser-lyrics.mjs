const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const numbers = process.env.TEST_HYMNS?.split(',').map(Number) || [1, 8, 83, 379, 524, 585];
// La app adelanta la letra al audio (LYRICS_LEAD_SECONDS en audioMode.js): para
// que una frase esté activa hay que situar currentTime ese tanto antes de su inicio.
const LEAD = Number(process.env.TEST_LEAD ?? 1);
for (const number of numbers) {
  for (const mode of ['sung', 'karaoke']) {
    await page.goto(`${baseUrl}/${number}?mode=${mode}`);
    await page.waitForFunction(() => !document.querySelector('#hymn-notice').textContent.includes('Preparando') && document.querySelector('#hymn-audio').readyState > 0);
    const result = await page.evaluate(async (number) => {
      const { findHymn } = await import('/src/js/api/hymnsApi.js');
      const { getPlaybackLyrics } = await import('/src/js/services/lyricsService.js');
      const playback = await getPlaybackLyrics(await findHymn(number));
      const audio = document.querySelector('#hymn-audio');
      audio.pause();
      return { lines: playback.lines, duration: audio.duration, estimated: playback.estimated };
    }, number);
    assert.ok(result.lines.length, `${number} ${mode} timeline`);
    const sections = result.lines.filter((line, index) => !index || line.occurrence !== result.lines[index-1].occurrence);
    for (const line of [...sections, ...sections.toReversed()]) {
      await page.evaluate(time => {
        const audio = document.querySelector('#hymn-audio');
        audio.currentTime = time;
        audio.dispatchEvent(new Event('seeking'));
      }, Math.max(0, line.start - LEAD + 0.01));
      await page.waitForFunction(text => document.querySelector('#lyric-current').textContent === text, line.text);
      assert.equal(await page.locator('#lyric-section').textContent(), line.type === 'chorus' ? 'Coro' : `Estrofa ${line.verse}`);
    }
    // También cruza un límite con el reloj real del audio en marcha.
    if (sections.length > 1) {
      const boundary = sections[1];
      await page.evaluate(async time => {
        const audio = document.querySelector('#hymn-audio');
        audio.currentTime = time - 0.2;
        await audio.play();
      }, boundary.start);
      await page.waitForFunction(text => document.querySelector('#lyric-current').textContent === text, boundary.text);
      await page.evaluate(() => document.querySelector('#hymn-audio').pause());
    }
    await page.keyboard.press('l');
    assert.ok(await page.locator('#lyrics-list').isVisible());
    await page.locator('#lyrics-list li').nth(2).click();
    await page.waitForFunction(text => document.querySelector('#lyric-current').textContent === text, result.lines[2].text);
    await page.keyboard.press('l');
    assert.ok(await page.locator('#lyrics-stage').isVisible());
    await page.evaluate(() => {
      const audio = document.querySelector('#hymn-audio');
      audio.currentTime = audio.duration;
      audio.play();
    });
    await page.waitForFunction(() => document.querySelector('#lyric-current').textContent === '');
    console.log(JSON.stringify({ number, mode, fragments: result.lines.length, sections: sections.length, duration: result.duration, estimated: result.estimated }));
  }
}
await page.goto(`${baseUrl}/8?mode=lyrics`);
await page.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
await page.keyboard.press('ArrowRight');
assert.ok(await page.locator('#lyrics-stage').isVisible());
assert.equal(await page.locator('#lyric-section').isVisible(), false);
assert.ok((await page.locator('#lyric-current').textContent()).length);
assert.deepEqual(errors, []);
console.log('Modo Letra y consola verificados.');
await browser.close();
