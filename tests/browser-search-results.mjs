import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3400';
const catalog = JSON.parse(await readFile(new URL('../data/himnario-api.json', import.meta.url), 'utf8'));
const matches = catalog.filter(h => h.title.toLowerCase().includes('jesu')).slice(0, 8);
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Simula el reproductor para comprobar los intentos de inicio y el bloqueo del navegador.
  await page.addInitScript(() => {
    window.playCalls = 0;
    window.blockPlayback = false;
    const sources = new WeakMap(), paused = new WeakMap();
    Object.defineProperties(HTMLMediaElement.prototype, {
      src: { configurable: true, get() { return sources.get(this) || ''; }, set(value) { sources.set(this, value); } },
      paused: { configurable: true, get() { return paused.get(this) ?? true; } },
      readyState: { configurable: true, get() { return 4; } },
      duration: { configurable: true, get() { return 3600; } },
    });
    HTMLMediaElement.prototype.load = () => {};
    HTMLMediaElement.prototype.play = function () {
      window.playCalls++;
      if (window.blockPlayback) return Promise.reject(new DOMException('Bloqueado', 'NotAllowedError'));
      paused.set(this, false); this.dispatchEvent(new Event('play')); return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () { paused.set(this, true); this.dispatchEvent(new Event('pause')); };
  });
  await page.goto(base);
  await page.waitForFunction(() => document.activeElement?.id === 'search-input');
  const input = page.locator('#search-input');
  const active = page.locator('.suggestion-item.is-active .suggestion-number');
  async function query(text) {
    await input.fill(text);
    await page.waitForSelector('.suggestion-item.is-active');
  }
  async function checkActive(number) {
    assert.equal((await active.textContent()).trim(), String(number));
    assert.equal(await input.evaluate(el => el === document.activeElement), true);
  }
  async function goHome() {
    await page.keyboard.press('Escape');
    await page.waitForURL(base + '/');
    assert.equal(await input.inputValue(), '');
    assert.equal(await input.evaluate(el => el === document.activeElement), true);
  }
  let calls = 0;
  for (const offset of [0, 2]) {
    await query('jesu');
    await checkActive(matches[0].number);
    await page.keyboard.press('ArrowUp');
    await checkActive(matches[0].number);
    for (let i = 0; i < offset + 1; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await checkActive(matches[offset].number);
    await page.keyboard.press('Enter');
    await page.waitForURL(`**/${matches[offset].number}?mode=sung`);
    await page.waitForFunction(count => window.playCalls === count, ++calls);
    assert.equal(await page.locator('audio').evaluate(a => a.paused), false);
    // Un Enter mantenido no vuelve a abrir ni inicia otra reproducción.
    await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
    assert.equal(await page.evaluate(() => window.playCalls), calls);
    await goHome();
  }
  await query('jesu');
  await page.keyboard.press('ArrowDown');
  await query('Santo');
  const firstSanto = catalog.find(h => h.title.toLowerCase().includes('santo'));
  await checkActive(firstSanto.number);
  // La lista anterior no se puede abrir durante el debounce de la consulta nueva.
  await input.fill('25');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/25?mode=sung');
  await page.waitForFunction(count => window.playCalls === count, ++calls);
  await goHome();
  await input.fill('zzzzzzsincoincidencias');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.suggestion-message');
  assert.equal(new URL(page.url()).pathname, '/');
  assert.equal(await page.locator('.suggestion-item').count(), 0);
  assert.equal(await page.evaluate(() => window.playCalls), calls);
  // Apertura bloqueada: queda abierto y el inicio manual reutiliza el reproductor.
  await page.evaluate(() => { window.blockPlayback = true; });
  await query('1');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/1?mode=sung');
  await page.waitForSelector('#hymn-start');
  assert.equal(await page.evaluate(() => window.playCalls), ++calls);
  await page.evaluate(() => { window.blockPlayback = false; });
  await page.locator('#hymn-start').click();
  await page.waitForFunction(count => window.playCalls === count, ++calls);
  assert.equal(await page.locator('audio').evaluate(a => a.paused), false);
  await goHome();
  assert.deepEqual(errors, []);
  console.log('Primer resultado, flechas, Enter, reinicio de selección, consulta inmediata, cero coincidencias, Esc, inicio automático único y bloqueo con inicio manual: correctos.');
} finally { await browser.close(); }
