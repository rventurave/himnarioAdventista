import { createVisualSections, groupVisualSections, blockForCue } from '../../utils/lyricBlocks.js';

// Una única capa visible: salida 200 ms + entrada 200 ms, sin superposición.
export function createBlockPresentation({ stage, current, previous, next, content, topbar, notice, nav, onLabel }) {
  let model = { sections: [], aligned: true }, blocks = [], index = -1, cue = -1;
  let anchor = null, animation = null, phase = null, pending = null, revision = 0;
  let measureCache = new Map();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const measure = document.createElement('div');
  measure.className = 'lyric-current lyric-measure';
  measure.setAttribute('aria-hidden', 'true');
  document.body.appendChild(measure);

  function metrics() {
    const layout = getComputedStyle(content);
    const stageStyle = getComputedStyle(stage);
    const stageWidth = stage.getBoundingClientRect().width || Math.min(content.clientWidth, parseFloat(stageStyle.maxWidth) || content.clientWidth);
    const width = Math.max(40, stageWidth - parseFloat(stageStyle.paddingLeft) - parseFloat(stageStyle.paddingRight));
    const gap = parseFloat(layout.rowGap) || 0;
    const start = content.querySelector('#hymn-start');
    const controls = (nav.hidden ? 0 : nav.getBoundingClientRect().height + gap) +
      (start.hidden ? 0 : start.getBoundingClientRect().height + gap);
    const available = Math.max(40, content.clientHeight - parseFloat(layout.paddingTop) -
      parseFloat(layout.paddingBottom) - controls);
    stage.style.setProperty('--lyrics-stage-height', `${Math.floor(available)}px`);
    // La medición usa siempre el tamaño base, sin el ajuste de un bloque largo.
    current.style.fontSize = '';
    const css = getComputedStyle(current);
    measure.style.width = `${width}px`;
    measure.style.fontFamily = css.fontFamily;
    measure.style.fontSize = css.fontSize;
    measure.style.fontWeight = css.fontWeight;
    measure.style.lineHeight = css.lineHeight;
    measure.style.letterSpacing = css.letterSpacing;
    measureCache = new Map();
    return available;
  }
  function fitsFor(height) {
    return lines => {
      const text = lines.join('\n');
      if (!measureCache.has(text)) {
        measure.textContent = text;
        measureCache.set(text, measure.getBoundingClientRect().height + 16 <= height - 8 && measure.scrollWidth <= measure.clientWidth + 1);
      }
      return measureCache.get(text);
    };
  }
  function relayout() {
    const height = metrics();
    blocks = groupVisualSections(model.sections, fitsFor(height));
    measure.textContent = "";
  }
  function label(block) {
    return `${block.type === 'chorus' ? 'Coro' : `Estrofa ${block.verse}`}${block.parts > 1 ? ` · ${block.part}/${block.parts}` : ''}`;
  }
  function paint(target) {
    index = target.index; cue = target.cue;
    const block = blocks[index];
    anchor = target.anchor ?? block?.rows[0].id ?? null;
    current.replaceChildren();
    previous.hidden = true; next.hidden = true;
    previous.textContent = ''; next.textContent = '';
    if (!block) { delete current.dataset.block; onLabel('', ''); return; }
    current.dataset.block = block.id;
    current.dataset.blockIndex = String(index);
    current.dataset.scroll = String(block.scroll);
    for (const row of block.rows) {
      const verse = document.createElement('span');
      verse.className = 'lyric-verse';
      verse.dataset.row = String(row.id);
      verse.classList.toggle('active', row.cues.includes(cue));
      verse.textContent = row.text;
      current.appendChild(verse);
    }
    fitBlockFont(block);
    current.scrollTop = 0;
    onLabel(label(block), `${index + 1} / ${blocks.length}`);
  }
  // Sin barras de desplazamiento: un bloque excepcional reduce su fuente para caber completo.
  function fitBlockFont(block) {
    current.style.fontSize = '';
    if (!block?.scroll) return;
    const base = parseFloat(getComputedStyle(current).fontSize) || 0;
    if (!base) return;
    const floor = base * 0.5;
    let size = base;
    for (let i = 0; i < 5 && size > floor && current.scrollHeight > current.clientHeight + 1; i++) {
      size = Math.max(size * Math.sqrt(current.clientHeight / current.scrollHeight), floor);
      current.style.fontSize = `${size}px`;
    }
  }
  function highlight(activeCue) {
    cue = activeCue;
    const block = blocks[index];
    if (!block) return;
    onLabel(label(block), `${index + 1} / ${blocks.length}`);
    current.querySelectorAll('.lyric-verse').forEach((element, i) => element.classList.toggle('active', block.rows[i].cues.includes(cue)));
  }
  function cancel() {
    revision++;
    animation?.cancel(); animation = null; phase = null; pending = null;
  }
  function request(target, instant = false) {
    if (instant || index < 0 || target.index < 0 || reducedMotion.matches || stage.hidden || typeof current.animate !== 'function') {
      cancel(); paint(target); return;
    }
    if (phase) { pending = target; return; }
    if (blocks[index]?.id === blocks[target.index]?.id && current.dataset.block === blocks[target.index]?.id) {
      highlight(target.cue); return;
    }
    pending = target;
    const direction = target.index >= index ? 1 : -1;
    const token = ++revision;
    phase = 'out';
    stage.dataset.direction = direction > 0 ? 'forward' : 'backward';
    animation = current.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-direction * 110}%)` }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    animation.finished.then(() => {
      if (token !== revision) return;
      const chosen = pending; pending = null;
      const enteringDirection = chosen.index >= index ? 1 : -1;
      animation.cancel(); paint(chosen);
      phase = 'in';
      animation = current.animate([{ transform: `translateX(${enteringDirection * 110}%)` }, { transform: 'translateX(0)' }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
      return animation.finished.then(() => {
        if (token !== revision) return;
        animation.cancel(); animation = null; phase = null;
        const latest = pending; pending = null;
        if (latest) request(latest);
      });
    }).catch(() => {});
  }
  function show(blockIndex, activeCue = -1, instant = false, source = null) {
    request({ index: blockIndex, cue: activeCue, anchor: source }, instant);
  }
  function resize() {
    if (!model.sections.length) return;
    const targetCue = pending?.cue ?? cue;
    const source = pending ? pending.anchor ?? blocks[pending.index]?.rows[0].id
      : cue >= 0 ? model.sections.flatMap(s => s.rows).find(r => r.cues.includes(cue))?.id : anchor;
    cancel(); relayout();
    if (source !== null && source !== undefined) show(blocks.findIndex(b => b.rows.some(r => r.id === source)), targetCue, true, source);
  }
  let resizeFrame;
  const schedule = () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(resize); };
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && phase) {
      const latest = pending || { index, cue, anchor };
      cancel(); paint(latest);
    }
  });
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  document.addEventListener('fullscreenchange', schedule);
  document.fonts?.addEventListener('loadingdone', schedule);
  const observer = new ResizeObserver(schedule);
  for (const element of [topbar, content, notice, nav, content.querySelector('#hymn-start')]) observer.observe(element);

  return {
    prepare(structure, timeline = []) { cancel(); model = createVisualSections(structure, timeline); index = -1; cue = -1; anchor = null; relayout(); return blocks; },
    clear() { cancel(); model = { sections: [], aligned: true }; blocks = []; index = -1; anchor = null; current.replaceChildren(); delete current.dataset.block; },
    show,
    timed(activeCue, { finished = false, beforeStart = false } = {}) {
      if (finished || beforeStart) { show(-1, -1, true); return; }
      if (activeCue < 0) { highlight(-1); return; }
      const target = blockForCue(blocks, activeCue);
      const source = model.sections.flatMap(s => s.rows).find(r => r.cues.includes(activeCue))?.id;
      if (target >= 0) show(target, activeCue, false, source);
    },
    get blocks() { return blocks; },
    get index() { return pending?.index ?? index; },
    get aligned() { return model.aligned; },
    relayout: resize,
  };
}
