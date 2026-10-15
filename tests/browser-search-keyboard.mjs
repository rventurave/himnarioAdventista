import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3400';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Sin audio', 'NotAllowedError'));
  });
  await page.goto(base);
  const input = page.locator('#search-input');
  await input.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.activeElement?.id === 'search-input');
  await page.locator('.selector-btn').click();
  await page.locator('.opcion[data-value="lyrics"]').click();
  for (const number of ['1', '25', '613']) {
    // Escribir con el foco fuera de los controles también activa el buscador.
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.type(number);
    await page.waitForSelector('#search-suggestions.visible .suggestion-item');
    assert.equal(await input.inputValue(), number);
    assert.equal((await page.locator('.suggestion-number').first().textContent()).trim(), number);
    await page.keyboard.press('Enter');
    await page.waitForURL(`**/${number}?mode=lyrics`);
    await page.waitForSelector('#hymn-playback');
    await page.keyboard.press('Escape');
    await page.waitForURL(base + '/');
    assert.equal(await input.inputValue(), '');
    assert.equal(await input.evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#search-selected').isVisible(), false);
    assert.equal(await page.locator('#search-suggestions').isVisible(), false);
  }
  await page.keyboard.type('Santo');
  await page.waitForSelector('#search-suggestions.visible .suggestion-item');
  assert.ok((await page.locator('.suggestion-title').allTextContents()).every(t => t.toLowerCase().includes('santo')));
  // Un botón enfocado conserva sus teclas; otro campo y un modal conservan la escritura.
  await page.locator('.selector-btn').focus();
  await page.keyboard.press('f');
  assert.equal(await input.inputValue(), 'Santo');
  await page.evaluate(() => {
    const other = document.createElement('textarea');
    other.id = 'other-input'; document.body.append(other); other.focus();
  });
  await page.keyboard.type('25');
  assert.equal(await page.locator('#other-input').inputValue(), '25');
  assert.equal(await input.inputValue(), 'Santo');
  await page.evaluate(() => {
    document.querySelector('#other-input').remove();
    const dialog = document.createElement('dialog');
    dialog.textContent = 'Modal'; document.body.append(dialog); dialog.showModal();
  });
  await page.keyboard.press('f');
  assert.equal(await input.inputValue(), 'Santo');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('dialog').remove());
  // Las respuestas pendientes no deben repoblar la búsqueda al regresar.
  await input.fill('Santo');
  await page.waitForSelector('#search-suggestions.visible .suggestion-item');
  await page.locator('.suggestion-item').first().click();
  await page.locator('#search-form button[type="submit"]').click();
  await page.waitForSelector('#hymn-playback');
  await page.keyboard.press('Escape');
  assert.equal(await input.inputValue(), '');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#search-suggestions').isVisible(), false);
  assert.deepEqual(errors, []);
  await page.close();

  const mobile = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const touchPage = await mobile.newPage();
  await touchPage.goto(base);
  await touchPage.waitForFunction(() => !document.querySelector('#view-home').hidden);
  assert.equal(await touchPage.locator('#search-input').evaluate(el => el === document.activeElement), false);
  await touchPage.locator('#search-input').tap();
  await touchPage.keyboard.type('25');
  await touchPage.waitForSelector('#search-suggestions.visible .suggestion-item');
  await touchPage.keyboard.press('Enter');
  await touchPage.waitForURL('**/25?mode=sung');
  await touchPage.keyboard.press('Escape');
  await touchPage.waitForURL(base + '/');
  assert.equal(await touchPage.locator('#search-input').inputValue(), '');
  assert.equal(await touchPage.locator('#search-input').evaluate(el => el === document.activeElement), false);
  await mobile.close();
  console.log('Búsqueda por número/título, foco inicial, escritura sin clic, Esc repetido, selección, controles, campos, modal y móvil: correctos.');
} finally { await browser.close(); }
