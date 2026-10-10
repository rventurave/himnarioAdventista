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
  await page.locator('#search-input').waitFor();
  assert.match(await page.title(), /Himnario Adventista del Séptimo Día/);
  assert.equal(await page.locator('.home-description').count(), 0);
  assert.doesNotMatch(await page.locator('#view-home').textContent(), /Consulta online los 613 himnos|Selecciona Letra para recorrer las estrofas/);
  assert.equal(await page.locator('#hymn-audio').getAttribute('src'), null);
  assert.deepEqual(heavy, [], 'sin precarga de audio ni sincronizaciones en portada');
  assert.deepEqual(errors, []);
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await plain.newPage();
  await staticPage.goto(base);
  assert.ok(await staticPage.locator('#search-input').isVisible());
  assert.equal(await staticPage.locator('.home-description').count(), 0);
  await plain.close();
  console.log('Portada: metadatos conservados, párrafos eliminados y buscador visible con/sin JavaScript; sin precarga de audio ni sincronización.');
} finally {
  await browser.close();
}
