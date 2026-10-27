import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHymn, expandHymn } from '../src/js/utils/hymnParser.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3400';
const catalog = JSON.parse(await readFile(new URL('../data/himnario-api.json', import.meta.url), 'utf8'));
const longest = catalog.reduce((a, b) => a.title.length > b.title.length ? a : b);

// Corpus liviano: TXT -> estructura -> bloques. No depende de .sync.json ni de MP3.
const corpus = await Promise.all(catalog.map(async hymn => {
  const text = await readFile(new URL(`../data${hymn.txtRoute}`, import.meta.url), 'utf8');
  const structure = parseHymn(text);
  const timeline = expandHymn(structure).map((line, i) => ({ ...line, start: i * 2, end: i * 2 + 1 }));
  return { hymn, structure, timeline };
}));

const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
const blockAudio = context => context.addInitScript(() => {
  HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Sin audio', 'NotAllowedError'));
});

try {
  // Portada y referencia se verifican exhaustivamente en browser-covers.mjs.
  /* =====================================================
     2. Buscador: número morado + título separado, sin guion ni barra
  ===================================================== */
  const searchCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await blockAudio(searchCtx);
  await searchCtx.route('**/*.mp3', route => route.fulfill({ status: 404, body: '' }));
  const searchPage = await searchCtx.newPage();
  const searchErrors = [];
  searchPage.on('pageerror', error => searchErrors.push(error.message));
  await searchPage.goto(base);
  await searchPage.locator('#search-input').waitFor();
  assert.ok(await searchPage.locator('#search-input').isVisible());
  assert.equal(await searchPage.locator('#search-selected').isVisible(), false);

  await searchPage.locator('#search-input').fill('1');
  await searchPage.waitForSelector('#search-suggestions.visible .suggestion-item');
  await searchPage.locator('.suggestion-item').first().click();
  assert.ok(await searchPage.locator('#search-selected').isVisible(), 'selección visible');
  assert.equal(await searchPage.locator('#search-input').isVisible(), false, 'input oculto durante la selección');
  assert.equal(await searchPage.locator('#search-selected-number').textContent(), '1');
  assert.equal(await searchPage.locator('#search-selected-title').textContent(), catalog[0].title);
  assert.equal(await searchPage.locator('#search-selected-number').evaluate(el => getComputedStyle(el).color), 'rgb(157, 0, 255)');
  const selectedRow = (await searchPage.locator('#search-selected').textContent()).replace('✕', '');
  assert.ok(!selectedRow.includes('-'), 'sin guion');
  assert.ok(!selectedRow.includes('|'), 'sin barra vertical');
  const rowGeometry = await searchPage.evaluate(() => {
    const number = document.querySelector('#search-selected-number').getBoundingClientRect();
    const title = document.querySelector('#search-selected-title').getBoundingClientRect();
    return { sameRow: Math.abs(number.top - title.top) < Math.max(number.height, title.height) * 0.7, order: number.left <= title.left };
  });
  assert.ok(rowGeometry.sameRow && rowGeometry.order, 'número y título alineados en la misma fila');
  assert.ok(await searchPage.locator('#search-form button[type="submit"]').isVisible(), 'botón reproducir');
  assert.ok(await searchPage.locator('.selector').isVisible(), 'selector de modo');

  // Botón de eliminar selección
  await searchPage.locator('#search-selected-clear').click();
  assert.equal(await searchPage.locator('#search-selected').isVisible(), false);
  assert.ok(await searchPage.locator('#search-input').isVisible());
  assert.equal(await searchPage.locator('#search-input').inputValue(), '');

  // Búsqueda por título
  await searchPage.locator('#search-input').fill('cantad');
  await searchPage.waitForSelector('#search-suggestions.visible .suggestion-item');
  assert.ok((await searchPage.locator('.suggestion-item').count()) >= 1, 'búsqueda por título');

  // Selección + abrir con el botón reproducir
  await searchPage.locator('#search-input').fill('1');
  await searchPage.waitForSelector('#search-suggestions.visible .suggestion-item');
  await searchPage.locator('.suggestion-item').first().click();
  await searchPage.locator('#search-form button[type="submit"]').click();
  await searchPage.waitForURL('**/1?mode=sung');
  assert.ok(await searchPage.locator('#view-hymn').isVisible(), 'navega al himno seleccionado');
  assert.deepEqual(searchErrors, []);
  await searchCtx.close();
  console.log('Buscador: número morado, título aparte sin separador, eliminar selección, búsqueda por número/título y apertura correctos.');

  /* =====================================================
     3. Sin barras de desplazamiento ni recorte en los 613 bloques
  ===================================================== */
  const scrollCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await blockAudio(scrollCtx);
  const scrollPage = await scrollCtx.newPage();
  const scrollErrors = [];
  scrollPage.on('pageerror', error => scrollErrors.push(error.message));
  await scrollPage.goto(`${base}/1?mode=lyrics`);
  await scrollPage.waitForFunction(() => !document.querySelector('#hymn-nav').hidden);
  await scrollPage.evaluate(async () => { (await import('/src/js/components/hymn/lyricsMode.js')).stop(); await document.fonts.ready; });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await scrollPage.setViewportSize(viewport);
    const result = await scrollPage.evaluate(async corpus => {
      const view = await import('/src/js/components/hymn/hymnView.js');
      const current = document.querySelector('#lyric-current');
      view.showStage(true); view.showTopbar(true); view.showNav(true); view.clearNotice();
      const report = { blocks: 0, shrunk: 0, overflowY: getComputedStyle(current).overflowY, cut: [] };
      for (const { hymn, structure, timeline } of corpus) {
        view.renderHeader(hymn);
        view.prepareBlocks(structure, timeline);
        const blocks = view.getBlocks();
        for (let i = 0; i < blocks.length; i++) {
          view.renderBlock(i, true);
          if (current.scrollHeight > current.clientHeight + 2) report.cut.push(`${hymn.number}:${blocks[i].occurrence}:${blocks[i].part}`);
          if (blocks[i].scroll) report.shrunk++;
        }
        report.blocks += blocks.length;
      }
      return report;
    }, corpus);
    assert.equal(result.overflowY, 'hidden', `overflow del contenedor de letras @${viewport.width}`);
    assert.deepEqual(result.cut, [], `recorte de texto @${viewport.width}`);
    console.log(`Sin barras ${viewport.width}×${viewport.height}: ${result.blocks} bloques, ${result.shrunk} con fuente reducida, 0 recortados.`);
  }

  // Transiciones horizontales al avanzar y retroceder.
  await scrollPage.setViewportSize({ width: 1280, height: 800 });
  await scrollPage.evaluate(async sample => {
    const view = await import('/src/js/components/hymn/hymnView.js');
    view.renderHeader(sample.hymn); view.prepareBlocks(sample.structure, sample.timeline); view.renderBlock(0, true);
  }, corpus[0]);
  await scrollPage.waitForTimeout(100);
  await scrollPage.evaluate(async () => (await import('/src/js/components/hymn/hymnView.js')).renderBlock(1));
  const forward = await scrollPage.locator('#lyric-current').evaluate(el => el.getAnimations()[0]?.effect.getKeyframes().at(-1)?.transform);
  assert.ok(forward && forward.includes('-110%'), 'avance hacia la izquierda');
  await scrollPage.waitForTimeout(450);
  assert.equal(await scrollPage.locator('#lyric-current').getAttribute('data-block-index'), '1');
  await scrollPage.evaluate(async () => (await import('/src/js/components/hymn/hymnView.js')).renderBlock(0));
  const backward = await scrollPage.locator('#lyric-current').evaluate(el => el.getAnimations()[0]?.effect.getKeyframes().at(-1)?.transform);
  assert.ok(backward && backward.includes('110%') && !backward.includes('-110%'), 'retroceso hacia la derecha');
  assert.deepEqual(scrollErrors, []);
  await scrollCtx.close();
  console.log('Bloques: sin barras, sin recorte y transiciones horizontales correctas.');

  /* =====================================================
     4. Pantalla completa desde la portada, sincronizada con el himno
  ===================================================== */
  const fullCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await blockAudio(fullCtx);
  await fullCtx.route('**/*.mp3', route => route.fulfill({ status: 404, body: '' }));
  const fullPage = await fullCtx.newPage();
  const fullErrors = [];
  fullPage.on('pageerror', error => fullErrors.push(error.message));
  await fullPage.goto(base);
  assert.ok(await fullPage.locator('#home-fullscreen').isVisible(), 'botón de pantalla completa en la portada');
  await fullPage.locator('#home-fullscreen').click();
  await fullPage.waitForFunction(() => Boolean(document.fullscreenElement));
  assert.deepEqual(await fullPage.evaluate(() => ({
    home: document.querySelector('#home-fullscreen').classList.contains('is-fullscreen'),
    hymn: document.querySelector('#hymn-fullscreen').classList.contains('is-fullscreen'),
    pressed: document.querySelector('#home-fullscreen').getAttribute('aria-pressed'),
  })), { home: true, hymn: true, pressed: 'true' }, 'ambos botones sincronizados');

  // Navegar a un himno y volver conserva la pantalla completa (SPA, mismo documento).
  await fullPage.evaluate(async () => (await import('/src/js/core/router.js')).navigate('/1?mode=lyrics'));
  await fullPage.waitForFunction(() => !document.querySelector('#view-hymn').hidden);
  assert.ok(await fullPage.evaluate(() => Boolean(document.fullscreenElement)), 'pantalla completa al entrar al himno');
  await fullPage.evaluate(async () => (await import('/src/js/core/router.js')).navigate('/'));
  await fullPage.waitForFunction(() => !document.querySelector('#view-home').hidden);
  assert.ok(await fullPage.evaluate(() => Boolean(document.fullscreenElement)), 'pantalla completa al volver a la portada');

  // Esc en pantalla completa lo gestiona el navegador: no navega a otra ruta.
  await fullPage.keyboard.press('Escape');
  assert.equal(new URL(fullPage.url()).pathname, '/', 'Esc no navega estando en pantalla completa');

  // El mismo botón sale de pantalla completa.
  await fullPage.locator('#home-fullscreen').click();
  await fullPage.waitForFunction(() => !document.fullscreenElement);
  assert.deepEqual(await fullPage.evaluate(() => ({
    home: document.querySelector('#home-fullscreen').classList.contains('is-fullscreen'),
    pressed: document.querySelector('#home-fullscreen').getAttribute('aria-pressed'),
  })), { home: false, pressed: 'false' });
  assert.deepEqual(fullErrors, []);
  await fullCtx.close();

  // Sin Fullscreen API se ofrece una vista ampliada voluntaria.
  const noFsCtx = await browser.newContext();
  await noFsCtx.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true, writable: true });
  });
  const noFsPage = await noFsCtx.newPage();
  await noFsPage.goto(base);
  assert.equal(await noFsPage.locator('#home-fullscreen').isVisible(), true, 'portada: alternativa sin API');
  await noFsPage.locator('#home-fullscreen').click();
  assert.ok(await noFsPage.evaluate(() => document.body.classList.contains('is-immersive')));
  await noFsPage.keyboard.press('Escape');
  assert.equal(await noFsPage.evaluate(() => document.body.classList.contains('is-immersive')), false);
  await noFsPage.goto(`${base}/1?mode=lyrics`);
  await noFsPage.locator('#hymn-fullscreen').waitFor();
  assert.equal(await noFsPage.locator('#hymn-fullscreen').isVisible(), true, 'himno: alternativa sin API');
  await noFsCtx.close();
  console.log('Pantalla completa: portada y himno sincronizados, se conserva al navegar, sin API se ofrece vista ampliada.');

  console.log('Visual: 613 himnos, buscador morado, sin barras y pantalla completa verificados.');
} finally {
  await browser.close();
}
