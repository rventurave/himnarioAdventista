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
  assert.equal(await page.title(), 'Himnario Adventista del Séptimo Día | 613 Himnos');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://himnario-adventista.pages.dev/');
  assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), 'https://himnario-adventista.pages.dev/');
  for (const path of ['robots.txt', 'sitemap.xml']) {
    const response = await page.request.get(`${base}/${path}`);
    assert.equal(response.status(), 200);
    assert.ok((await response.text()).includes('https://himnario-adventista.pages.dev/'));
  }
  assert.equal(await page.locator('.home-description').count(), 0);
  assert.doesNotMatch(await page.locator('#view-home').textContent(), /Consulta online los 613 himnos/);
  const footerLink = page.locator('.home-footer a[href="/himnos"]');
  assert.ok(await footerLink.isVisible());
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 640, height: 320 }]) {
    await page.setViewportSize(viewport);
    const form = await page.locator('#search-form').boundingBox();
    const footer = await footerLink.boundingBox();
    assert.ok(footer.y >= form.y + form.height, 'pie separado del buscador');
    assert.ok(footer.y + footer.height <= viewport.height, 'pie visible');
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.equal(await page.locator('#hymn-audio').getAttribute('src'), null);
  assert.deepEqual(heavy, [], 'sin precarga de audio ni sincronizaciones en portada');
  assert.deepEqual(errors, []);
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await plain.newPage();
  await staticPage.goto(base);
  assert.ok(await staticPage.locator('#search-input').isVisible());
  assert.equal(await staticPage.locator('.home-description').count(), 0);

  assert.ok(await staticPage.locator('.home-footer a[href="/himnos"]').isVisible());
  await staticPage.locator('.home-footer a').click();
  assert.equal(await staticPage.locator('ol a').count(), 613);
  await staticPage.locator('ol a[href="/613"]').click();
  await staticPage.waitForURL('**/613');
  assert.ok(await staticPage.locator('#static-hymn').isVisible());
  assert.ok((await staticPage.locator('.static-lyrics').textContent()).length > 100);
  await staticPage.goto(`${base}/404`);
  assert.ok(await staticPage.locator('#static-hymn').isVisible());
  await footerLink.click();
  await page.waitForURL('**/himnos');
  assert.equal(await page.locator('ol a').count(), 613);
  await page.locator('ol a[href="/1"]').click();
  await page.waitForURL('**/1');
  await page.waitForFunction(() => !document.querySelector('#view-hymn').hidden);
  await page.waitForFunction(() => document.title.startsWith('Himno 1:'));
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://himnario-adventista.pages.dev/1');
  assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), 'https://himnario-adventista.pages.dev/1');
  await page.evaluate(async () => {
    const { navigate } = await import('/src/js/core/router.js');
    navigate('/');
  });
  await page.waitForFunction(() => document.title === 'Himnario Adventista del Séptimo Día | 613 Himnos');
  assert.deepEqual(errors, []);
  await plain.close();
  console.log('SEO: portada limpia, pie visible en escritorio/móvil, índice rastreable e himnos sin JavaScript.');
} finally {
  await browser.close();
}
