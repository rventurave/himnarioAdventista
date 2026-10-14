import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3400';
const catalog = JSON.parse(await readFile(new URL('../data/himnario-api.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
async function cover(page) {
  assert.ok(await page.locator('#hymn-intro').isVisible());
  for (const selector of ['.hymn-heading', '#lyrics-stage', '#lyrics-list', '#lyric-section']) {
    assert.equal(await page.locator(selector).isVisible(), false, selector);
  }
  assert.ok(await page.locator('#hymn-back').isVisible());
  assert.ok(await page.locator('#hymn-fullscreen').isVisible());
  const overlaps = await page.evaluate(() => {
    const c = document.querySelector('.intro-composition').getBoundingClientRect();
    return ['#hymn-back', '#hymn-fullscreen', '#hymn-start', '#hymn-nav'].some(selector => {
      const el = document.querySelector(selector);
      if (el.hidden) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top;
    });
  });
  assert.equal(overlaps, false, 'portada separada de controles');
}
async function content(page) {
  assert.equal(await page.locator('#hymn-intro').isVisible(), false);
  assert.equal(await page.locator('#hymn-title').isVisible(), false);
  assert.ok(await page.locator('#hymn-topbar').isVisible());
  assert.ok(await page.locator('#lyrics-stage').isVisible());
}
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  // Reloj de medios controlado: verifica estados sin descargar ni modificar audios.
  await context.addInitScript(() => {
    const times = new WeakMap();
    Object.defineProperties(HTMLMediaElement.prototype, {
      currentTime: { configurable: true, get() { return times.get(this) || 0; }, set(value) { times.set(this, value); } },
      duration: { configurable: true, get() { return window.testDuration || 3600; } },
      readyState: { configurable: true, get() { return 4; } },
      ended: { configurable: true, get() { return this.currentTime >= this.duration; } },
    });
    HTMLMediaElement.prototype.load = () => {};
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Prueba sin audio', 'NotAllowedError'));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/1?mode=lyrics`);
  await page.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
  await page.evaluate(async () => {
    (await import('/src/js/components/hymn/lyricsMode.js')).togglePlayback();
    await document.fonts.ready;
  });
  let wrapped = 0, single = 0;
  for (const viewport of [[320,568],[375,667],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1920,1080],[2560,1440],[844,390],[390,320]].map(([width,height]) => ({width,height}))) {
    await page.setViewportSize(viewport);
    const result = await page.evaluate(async catalog => {
      const view = await import('/src/js/components/hymn/hymnView.js');
      view.showStage(false); view.showList(false); view.showTopbar(false);
      const failures = [];
      let wrapped = 0, single = 0;
      for (const hymn of catalog) {
        view.renderHeader(hymn); view.showIntro();
        const title = document.querySelector('#intro-title');
        const composition = document.querySelector('.intro-composition');
        const t = title.getBoundingClientRect(), c = composition.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
        const lines = Math.round(t.height / lineHeight);
        if (lines >= 2) wrapped++; else if (lines === 1) single++;
        if (lines < 1 || t.height > document.querySelector('#hymn-intro').clientHeight - 8 || title.scrollWidth > title.clientWidth + 1 || c.left < 0 || c.right > innerWidth + 1 || Math.abs((c.left + c.right) / 2 - innerWidth / 2) > 2) failures.push(`portada ${hymn.number}: ${lines} líneas`);
        if (getComputedStyle(title).color !== 'rgb(255, 255, 255)' || !getComputedStyle(title).fontFamily.includes('Bebas Neue')) failures.push(`título ${hymn.number}`);
        for (const id of ['intro-number', 'hymn-number']) if (getComputedStyle(document.getElementById(id)).color !== 'rgb(157, 0, 255)') failures.push(`número ${hymn.number}`);
        for (const id of ['intro-separator', 'reference-separator']) if (getComputedStyle(document.getElementById(id)).color !== 'rgb(212, 175, 55)') failures.push(`barra ${hymn.number}`);
        view.resetIntro(); view.showTopbar(true);
        const row = document.querySelector('.hymn-title-row').getBoundingClientRect();
        const ref = document.querySelector('#hymn-reference').getBoundingClientRect();
        const full = document.querySelector('#hymn-fullscreen').getBoundingClientRect();
        if (row.left > innerWidth / 2 || row.right > full.left + 1 || (hymn.bibleReference && ref.right > full.left + 1)) failures.push(`referencia ${hymn.number}`);
        if (document.querySelector('#hymn-reference').textContent !== (hymn.bibleReference || '')) failures.push(`contenido ${hymn.number}`);
        view.showTopbar(false);
      }
      return { failures, wrapped, single };
    }, catalog);
    assert.deepEqual(result.failures, [], `${viewport.width}×${viewport.height}`);
    wrapped += result.wrapped; single += result.single;
    console.log(`Portadas/referencias ${viewport.width}×${viewport.height}: 613 himnos, ${result.single} en una línea y ${result.wrapped} en varias líneas.`);
  }
  assert.ok(wrapped > 0 && single > 0);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    for (const mode of ['sung', 'karaoke']) {
      await page.goto(`${base}/1?mode=${mode}`);
      await page.waitForFunction(() => !document.querySelector('#hymn-start').hidden);
      await cover(page);
      const fullBefore = await page.locator('#lyrics-list').textContent();
      const timing = await page.evaluate(async () => {
        const { findHymn } = await import('/src/js/api/hymnsApi.js');
        const playback = await (await import('/src/js/services/lyricsService.js')).getPlaybackLyrics(await findHymn(1));
        window.testDuration = playback.lines.at(-1).end + 5;
        return { first: playback.lines[0].start, duration: window.testDuration };
      });
      const seek = time => page.evaluate(time => {
        const audio = document.querySelector('audio'); audio.currentTime = time;
        audio.dispatchEvent(new Event('seeking')); audio.dispatchEvent(new Event('timeupdate'));
      }, time);
      await seek(Math.max(0, timing.first - 1 + 0.1)); await content(page);
      await page.evaluate(() => document.querySelector('audio').dispatchEvent(new Event('ended')));
      await content(page); // Un evento aislado no termina un audio que sigue en curso.
      await seek(timing.duration);
      await page.evaluate(() => document.querySelector('audio').dispatchEvent(new Event('ended')));
      await cover(page);
      assert.equal(await page.locator('#lyrics-list').textContent(), fullBefore);
      await seek(Math.max(0, timing.first - 1 + 0.1)); await content(page);
      await seek(0); await cover(page);
      await page.keyboard.press('f');
      await page.waitForFunction(() => Boolean(document.fullscreenElement));
      await cover(page);
      await page.keyboard.press('f');
      await page.waitForFunction(() => !document.fullscreenElement);
    }
    for (const manual of [false, true]) {
      if (manual) await page.route(/\.sync\.json(?:\?|$)|\.lrc(?:\?|$)/, route => route.fulfill({ status: 404, body: '' }));
      await page.goto(`${base}/1?mode=lyrics`);
      await page.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
      if (!manual) await page.evaluate(async () => (await import('/src/js/components/hymn/lyricsMode.js')).togglePlayback());
      await cover(page);
      const fullBefore = await page.locator('#lyrics-list').textContent();
      await page.keyboard.press('ArrowRight'); await content(page);
      await page.evaluate(async () => {
        const mode = await import('/src/js/components/hymn/lyricsMode.js');
        const view = await import('/src/js/components/hymn/hymnView.js');
        for (let i = 0, count = view.getBlocks().length; i < count; i++) mode.next();
      });
      await cover(page);
      assert.equal(await page.locator('#lyrics-list').textContent(), fullBefore);
      if (manual) {
        await page.keyboard.press('ArrowRight'); await cover(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(100);
        await cover(page);
      }
      await page.keyboard.press('ArrowLeft'); await content(page);
      await page.setViewportSize(viewport);
      if (manual) await page.unroute(/\.sync\.json(?:\?|$)|\.lrc(?:\?|$)/);
    }
  }
  // Fin natural del reloj de Solo letra, sin pulsar siguiente.
  const timedPage = await context.newPage();
  await timedPage.clock.install();
  await timedPage.clock.pauseAt(new Date(Date.now() + 1000));
  await timedPage.goto(`${base}/1?mode=lyrics`);
  await timedPage.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
  const fullText = await timedPage.locator('#lyrics-list').textContent();
  const end = await timedPage.evaluate(async () => {
    const hymn = await (await import('/src/js/api/hymnsApi.js')).findHymn(1);
    return (await (await import('/src/js/services/lyricsService.js')).getPlaybackLyrics(hymn)).lines.at(-1).end;
  });
  await timedPage.clock.runFor((end + 1) * 1000);
  await cover(timedPage);
  assert.equal(await timedPage.locator('#lyrics-list').textContent(), fullText);
  await timedPage.close();

  // Centrado vertical real y captura para inspección visual.
  await page.goto(`${base}/443?mode=lyrics`);
  await page.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
  await page.waitForTimeout(550);
  const centered = await page.evaluate(() => {
    const c = document.querySelector('.intro-composition').getBoundingClientRect();
    const area = document.querySelector('#hymn-intro').getBoundingClientRect();
    const nav = document.querySelector('#hymn-nav').getBoundingClientRect();
    return Math.abs((c.top + c.bottom) / 2 - (area.top + area.bottom) / 2) < 2 && c.bottom < nav.top;
  });
  assert.ok(centered, 'portada centrada y separada de controles');
  await page.screenshot({ path: '/tmp/hymn-cover-mobile.png' });
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Inicio, reproducción, cierre y regreso: letra automática/manual, cantado, karaoke y pantalla completa; DOM completo conservado.');
} finally { await browser.close(); }
