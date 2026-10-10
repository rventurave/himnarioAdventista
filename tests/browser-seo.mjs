import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3100';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
try {
  const page = await browser.newPage();
  const heavy = [], errors = [];
  page.on('request', request => {
    if (/\.mp3(?:\?|$)|\/data\/sync\/|\.lrc(?:\?|$)/.test(request.url())) heavy.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('.home-description').waitFor();
  assert.match(await page.title(), /Himnario Adventista del Séptimo Día/);
  assert.match(await page.locator('.home-description').textContent(), /613 himnos/);
  assert.equal(await page.locator('#hymn-audio').getAttribute('src'), null);
  assert.deepEqual(heavy, [], 'sin precarga de audio ni sincronizaciones en portada');
  assert.deepEqual(errors, []);
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await plain.newPage();
  await staticPage.goto(base);
  assert.ok(await staticPage.locator('.home-description').isVisible());
  await plain.close();
  console.log('Portada: metadatos, contenido visible sin JavaScript y ninguna carga de MP3/LRC/sincronización.');
} finally {
  await browser.close();
}
