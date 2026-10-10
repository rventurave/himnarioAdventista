import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { getHymnAudioUrl, getHymnLyricsUrl, getHymnSyncUrls, configure, getConfig } from '../src/js/api/hymnsApi.js';
import { resolveAudioUrl } from '../src/js/utils/audioUrl.js';

const catalog = JSON.parse(readFileSync(new URL('../data/himnario-api.json', import.meta.url)));
const base = getConfig().audioBaseUrl;
test('001: rutas exactas cantada e instrumental, datos locales independientes', () => {
  const hymn = catalog[0];
  assert.equal(getHymnAudioUrl(hymn), base + 'cantadas/001%20-%20Cantad%20alegres%20al%20Senor.mp3');
  assert.equal(getHymnAudioUrl(hymn, 'instrumental'), base + 'instrumentales/001%20-%20Cantad%20alegres%20al%20Senor.mp3');
  assert.equal(getHymnAudioUrl(hymn, 'karaoke'), getHymnAudioUrl(hymn, 'instrumental'));
  assert.equal(getHymnLyricsUrl(hymn), '/data/letras/001 - Cantad alegres al Senor.txt');
  assert.ok(getHymnSyncUrls(hymn).every(url => url.startsWith('/data/sync/')));
  configure({ audioBaseUrl: 'https://audio.example.com/data/audios/' });
  assert.ok(getHymnAudioUrl(hymn).startsWith('https://audio.example.com/'));
  assert.ok(getHymnLyricsUrl(hymn).startsWith('/data/'));
  configure({ audioBaseUrl: base });
});
test('prefijos, rutas absolutas, tildes, signos y codificación única', () => {
  for (const route of ['/audios/cantadas/186 - Hace años escuche.mp3', '/data/audios/cantadas/186%20-%20Hace%20a%C3%B1os%20escuche.mp3', 'https://old.example/data/audios/cantadas/186%20-%20Hace%20a%C3%B1os%20escuche.mp3']) {
    assert.equal(resolveAudioUrl(route, 'cantadas', base), base + 'cantadas/186%20-%20Hace%20a%C3%B1os%20escuche.mp3');
  }
  assert.equal(resolveAudioUrl('Niño #1? 100%.mp3', 'cantadas', base), base + 'cantadas/Ni%C3%B1o%20%231%3F%20100%25.mp3');
  assert.equal(getHymnAudioUrl({ mp3Url: 'real.mp3' }), base + 'cantadas/real.mp3');
});
test('referencias ausentes, carpetas incorrectas y rutas inseguras no se fabrican', () => {
  for (const route of [null, '', ' ', '/audios/instrumentales/a.mp3', '/tmp/a.mp3', '../a.mp3', 'javascript:a.mp3', 'cantadas/a%2Fb.mp3', 'a.wav']) {
    assert.equal(resolveAudioUrl(route, 'cantadas', base), null);
  }
  assert.equal(getHymnAudioUrl({ number: 1, title: 'Inventado', mp3Filename: '001.mp3' }), null);
});
test('613 referencias reales y letras: ningún audio depende del origen local', () => {
  assert.equal(catalog.length, 613);
  for (const hymn of catalog) {
    for (const mode of ['musica', 'instrumental']) {
      const url = getHymnAudioUrl(hymn, mode);
      assert.ok(url?.startsWith(base), `${hymn.number} ${mode}`);
      const filename = decodeURIComponent(new URL(url).pathname.split('/').at(-1));
      const route = mode === 'instrumental' ? hymn.mp3RouteInstr : hymn.mp3Route;
      assert.equal(filename, route.split('/').at(-1));
    }
    assert.ok(existsSync(new URL('..' + getHymnLyricsUrl(hymn), import.meta.url)), `TXT ${hymn.number}`);
  }
});
