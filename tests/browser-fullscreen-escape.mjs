import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3400';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
try {
  for (const mode of ['locked', 'rejected', 'immersive']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // La integración de Fullscreen/Keyboard Lock se simula: los permisos son del navegador.
    await page.addInitScript(mode => {
      let fullscreen = null;
      window.lockCalls = [];
      window.unlockCalls = 0;
      Object.defineProperty(document, 'fullscreenElement', { get: () => fullscreen });
      Element.prototype.requestFullscreen = mode === 'immersive' ? undefined : function () {
        fullscreen = this; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve();
      };
      document.exitFullscreen = () => {
        fullscreen = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve();
      };
      Object.defineProperty(navigator, 'keyboard', { value: {
        lock: keys => {
          window.lockCalls.push(keys);
          return mode === 'rejected' ? Promise.reject(new DOMException('Denegado', 'NotAllowedError')) : Promise.resolve();
        },
        unlock: () => { window.unlockCalls++; },
      } });
    }, mode);
    await page.goto(base);
    await page.waitForFunction(() => document.activeElement.id === 'search-input');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.querySelector('#home-fullscreen').getAttribute('aria-pressed') === 'true');
    await page.locator('.opcion[data-value="lyrics"]').click();
    for (const number of ['1', '25']) {
      await page.locator('#search-input').fill(number);
      await page.keyboard.press('Enter');
      await page.waitForURL(`**/${number}?mode=lyrics`);
      await page.waitForSelector('#hymn-playback');
      await page.keyboard.press('Escape');
      await page.waitForURL(base + '/');
      assert.equal(await page.locator('#home-fullscreen').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#search-input').inputValue(), '');
      assert.equal(await page.locator('#search-input').evaluate(el => el === document.activeElement), true);
    }
    if (mode !== 'immersive') assert.deepEqual(await page.evaluate(() => window.lockCalls), [['Escape']]);
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.querySelector('#home-fullscreen').getAttribute('aria-pressed') === 'false');
    if (mode !== 'immersive') assert.ok(await page.evaluate(() => window.unlockCalls > 0));
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Esc conserva la vista ampliada, regresa al buscador limpio y enfocado; Tab sale. Integración de Keyboard Lock y rechazo de permiso comprobados con API simulada.');
} finally { await browser.close(); }
