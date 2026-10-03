
// Conserva solo la envolvente: libera el PCM decodificado y el contexto tras analizar.
export async function analyzeAudio(url, signal) {
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  const Context = window.AudioContext || window.webkitAudioContext;
  const context = new Context();
  try {
    const buffer = await context.decodeAudioData(bytes);
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    const step = 0.1;
    const size = Math.round(buffer.sampleRate * step);
    const energy = new Array(Math.ceil(buffer.length / size)).fill(0);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let bin = 0; bin < energy.length; bin++) {
        let sum = 0, count = 0;
        for (let j = bin * size; j < Math.min(samples.length, (bin + 1) * size); j += 8) {
          sum += samples[j] * samples[j]; count++;
        }
        energy[bin] += Math.sqrt(sum / Math.max(1, count)) / buffer.numberOfChannels;
      }
    }
    return { energy, step, duration: buffer.duration };
  } finally { await context.close(); }
}
