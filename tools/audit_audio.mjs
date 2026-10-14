// Auditoría de solo lectura: descarga como máximo un byte por MP3 si R2 admite Range.
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getHymnAudioUrl, getConfig } from '../src/js/api/hymnsApi.js';
const exec = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const split = arg.indexOf('=');
  if (!arg.startsWith('--') || split < 0) throw new Error('Usa --output=archivo.json, --origin=https://dominio o --hymns=1,100');
  return [arg.slice(2, split), arg.slice(split + 1)];
}));
const origin = args.origin || 'https://himnario-adventista.pages.dev';
if (new URL(origin).origin !== origin) throw new Error('Origin debe ser un origen sin ruta ni barra final');
const catalog = JSON.parse(await readFile(new URL('../data/himnario-api.json', import.meta.url), 'utf8'));
const selected = args.hymns ? catalog.filter(h => args.hymns.split(',').map(Number).includes(h.number)) : catalog;
if (!selected.length) throw new Error('No hay himnos para auditar');
const base = getConfig().audioBaseUrl;
const entries = selected.flatMap(h => ['sung', 'karaoke'].map(mode => ({ number: h.number, title: h.title, mode, url: getHymnAudioUrl(h, mode) })));
for (const entry of entries) if (!entry.url?.startsWith(base) || new URL(entry.url).protocol !== 'https:') throw new Error(`URL incorrecta: ${JSON.stringify(entry)}`);
async function inspect(entry) {
  const cmd = ['--silent', '--show-error', '--max-time', '20', '--retry', '1', '--retry-delay', '1', '--range', '0-0', '--max-filesize', '1024', '--header', `Origin: ${origin}`, '--dump-header', '-', '--output', '/dev/null', '--write-out', '\n%{json}', entry.url];
  let stdout, error = null;
  try { ({ stdout } = await exec('curl', cmd, { maxBuffer: 128 * 1024 })); }
  catch (failure) { stdout = failure.stdout || ''; error = failure.stderr?.trim() || String(failure); }
  const lines = stdout.trim().split('\n');
  let meta = {};
  try { meta = JSON.parse(lines.pop()); } catch { /* El error de transporte se registra abajo. */ }
  const headers = {};
  for (const line of lines) {
    if (/^HTTP\//i.test(line)) for (const key of Object.keys(headers)) delete headers[key];
    const index = line.indexOf(':');
    if (index > 0) headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
  }
  const status = Number(meta.http_code || 0);
  const range = headers['content-range'] || null;
  return { ...entry, status, contentType: headers['content-type'] || null, bytesDownloaded: meta.size_download ?? null,
    acceptRanges: headers['accept-ranges'] || null, contentRange: range,
    allowOrigin: headers['access-control-allow-origin'] || null,
    audioOk: !error && status === 206 && /^audio\/mpeg(?:;|$)/i.test(headers['content-type'] || '') && /^bytes 0-0\/[1-9]\d*$/.test(range || ''),
    corsOk: [origin, '*'].includes(headers['access-control-allow-origin']), error };
}
const queue = [...entries], results = [];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    results.push(await inspect(queue.shift()));
    if (results.length % 100 === 0) console.log(`Auditados ${results.length}/${entries.length}`);
  }
}));
results.sort((a, b) => a.number - b.number || a.mode.localeCompare(b.mode));
const summary = { checkedAt: new Date().toISOString(), origin, audioBaseUrl: base, hymns: selected.length, urls: results.length,
  statuses: results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}),
  audioAndRangeOk: results.filter(r => r.audioOk).length, corsOk: results.filter(r => r.corsOk).length,
  failures: results.filter(r => !r.audioOk), corsFailures: results.filter(r => !r.corsOk).length };
if (args.output) await writeFile(args.output, JSON.stringify({ summary, results }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failures.length ? 1 : summary.corsFailures ? 2 : 0;
