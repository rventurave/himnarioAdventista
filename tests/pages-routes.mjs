// Ejecutar contra `wrangler pages dev dist` o el despliegue, no el servidor SPA.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const base = process.env.PAGES_TEST_BASE_URL;
assert.ok(base, 'Define PAGES_TEST_BASE_URL con el origen de Pages que deseas verificar');
const read = path => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');
const sitemap = await read('sitemap.xml');
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
assert.equal(paths.length, 615);
assert.equal(new Set(paths).size, 615);
const queue = [...paths, '/sitemap.xml', '/robots.txt', '/1?mode=lyrics', '/404?mode=karaoke', '/613?mode=sung'];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const path = queue.shift();
    const response = await fetch(new URL(path, base), { redirect: 'manual' });
    assert.equal(response.status, 200, `${path}: estado ${response.status}, Location ${response.headers.get('location')}`);
    const clean = path.split('?')[0];
    const file = clean === '/' ? 'index.html' : /^\/\d+$/.test(clean) ? `_hymns${clean}.html` : clean === '/himnos' ? 'himnos.html' : clean.slice(1);
    assert.equal(await response.text(), await read(file), `${path}: respuesta distinta al archivo de dist`);
  }
}));
for (const path of ['/999', '/data/letras/ausente.txt']) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' });
  assert.equal(response.status, 404, `${path}: debe responder 404`);
}
console.log('Pages: 615 URLs con HTTP 200 sin redirecciones, contenido idéntico a dist, sitemap/robots, modos y 404 correctos.');
