import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, initRouter } from '../src/js/core/router.js';
import { MODES, DEFAULT_MODE } from '../src/js/core/constants.js';

test('613 números: modo omitido, vacío o inválido usa sung; conserva los modos reales', () => {
  assert.equal(DEFAULT_MODE, 'sung');
  for (let number = 1; number <= 613; number++) {
    for (const search of ['', '?mode=', '?mode=invalido', ...Object.values(MODES).map(mode => `?mode=${mode}`)]) {
      const requested = new URLSearchParams(search).get('mode');
      const mode = Object.values(MODES).includes(requested) ? requested : DEFAULT_MODE;
      for (const pathname of [`/${number}`, `/${number}/`, `/_hymns/${number}`, `/_hymns/${number}.html`]) {
        assert.deepEqual(parseRoute({ pathname, search }), { name: 'hymn', id: String(number), mode });
      }
    }
  }
});

test('la inicialización de una ruta interna recupera la URL pública y conserva parámetros y hash', () => {
  const previous = globalThis.window;
  try {
    let current = new URL('https://example.com/_hymns/1?mode=karaoke#estrofa');
    const calls = [];
    globalThis.window = {
      get location() { return current; },
      history: {
        state: { test: true },
        replaceState(state, unused, path) {
          assert.deepEqual(state, { test: true });
          current = new URL(path, current);
        },
      },
      addEventListener() {},
    };
    initRouter({ onHome: () => calls.push('home'), onHymn: (id, mode) => calls.push([id, mode]) });
    assert.equal(current.pathname + current.search + current.hash, '/1?mode=karaoke#estrofa');
    assert.deepEqual(calls, [['1', 'karaoke']]);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
