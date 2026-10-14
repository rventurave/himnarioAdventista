import { getPlaybackLyrics, getStructuredLyrics } from "../../services/lyricsService.js";
import { findActiveIndex } from "../../utils/lyricsTimeline.js";
import { LYRICS_LEAD_SECONDS } from "../../core/constants.js";
import * as view from "./hymnView.js";

let manual = false;
let index = 0; // Presentación = 0, fragmentos manuales = 1..N.
let lines = [];
let activeIndex = -1;
let loadToken = 0;
let controller = null;
let timer = null;
let elapsed = 0;
let startedAt = null;
let contentVisible = false;

/** Solo letra: mismo ritmo que Cantado, usando un reloj sin audio. */
export async function start(hymn) {
  stop();
  const token = loadToken;
  controller = new AbortController();
  view.showList(false);
  view.showStage(false);
  view.showNav(false);
  view.setPlaybackAvailable(false);
  view.showTopbar(false);
  view.renderSlide("", "");
  view.renderCounter("");
  view.renderSection("");
  view.showIntro();
  view.renderNotice("Preparando sincronización…");

  let playback;
  try {
    playback = await getPlaybackLyrics(hymn, controller.signal, { allowAudioAnalysis: false });
  } catch {
    playback = { lines: [] };
  }
  if (token !== loadToken) return;

  const structure = await getStructuredLyrics(hymn);
  if (token !== loadToken) return;
  view.prepareBlocks(structure, playback.lines);
  if (playback.lines.length) {
    lines = playback.lines;
    view.setPlaybackAvailable(true);
    view.renderLyricsList(lines);
    view.showNav(true);
    view.renderNotice(playback.estimated ? "Avance automático con tiempos aproximados." : "");
    resume();
    renderTimed(true);
    return;
  }

  manual = true;
  view.renderLyricsList(structure.sequence.flatMap(section => {
    const source = section.type === 'chorus' ? structure.chorus : structure.verses.find(v => v.number === section.number);
    return source.lines.map(text => ({ text }));
  }));
  if (!view.getBlocks().length) {
    view.hideIntro();
    view.showTopbar(true);
    view.showStage(true);
    view.renderSlide("Letra no disponible", "");
    view.renderNotice("No se encontró la letra de este himno.");
    return;
  }

  view.showNav(true);
  view.renderNotice("Este himno no tiene tiempos disponibles. Usa las flechas para avanzar.");
  renderManual();
}

export function next() {
  if (lines.length) { navigateTimed(1); return; }
  if (manual) {
    if (!contentVisible && index > 0) return; // Portada final.
    const target = contentVisible ? view.getBlockIndex() + 1 : 0;
    if (target <= view.getBlocks().length) { index = target + 1; renderManual(); }
  }
}

export function prev() {
  if (lines.length) { navigateTimed(-1); return; }
  if (manual && index > 0) {
    index = contentVisible ? Math.max(0, view.getBlockIndex()) : view.getBlocks().length;
    renderManual();
  }
}

function navigateTimed(direction) {
  const blocks = view.getBlocks();
  let current = view.getBlockIndex();
  if (!contentVisible) current = currentTime() + LYRICS_LEAD_SECONDS >= lines.at(-1).end ? blocks.length : -1;
  const target = current + direction;
  if (target < 0) { seekTo(0); return; }
  if (target >= blocks.length) { seekTo(Math.max(0, lines.at(-1).end - LYRICS_LEAD_SECONDS)); return; }
  if (blocks[target].firstCue !== null) seekToLine(blocks[target].firstCue);
}

export function togglePlayback() {
  if (!lines.length) return;
  if (startedAt === null) {
    if (elapsed + LYRICS_LEAD_SECONDS >= lines.at(-1).end) elapsed = 0;
    resume();
    renderTimed(true);
    view.flashState("▶");
  } else {
    pause();
    view.flashState("⏸");
  }
}

export function stop() {
  loadToken += 1;
  controller?.abort();
  controller = null;
  pause();
  elapsed = 0;
  lines = [];
  manual = false;
  index = 0;
  activeIndex = -1;
  contentVisible = false;
  view.renderSection("");
  view.clearBlocks();
}

function currentTime() {
  return elapsed + (startedAt === null ? 0 : (performance.now() - startedAt) / 1000);
}

function resume() {
  view.setPlaybackState(true);
  startedAt = performance.now();
  timer = setInterval(() => renderTimed(false), 100);
}

function pause() {
  view.setPlaybackState(false);
  elapsed = currentTime();
  startedAt = null;
  clearInterval(timer);
  timer = null;
}

function seekToLine(target) {
  seekTo(Math.max(0, lines[target].start - LYRICS_LEAD_SECONDS));
}

function seekTo(time) {
  elapsed = time;
  if (startedAt !== null) startedAt = performance.now();
  renderTimed(true);
}

function renderTimed(force) {
  const clock = currentTime() + LYRICS_LEAD_SECONDS;
  const nextIndex = findActiveIndex(lines, clock);
  const finished = clock >= lines.at(-1).end;
  const showContent = clock >= lines[0].start && !finished;
  if (showContent !== contentVisible) {
    contentVisible = showContent;
    if (showContent) view.hideIntro();
    else if (!finished) view.showIntro();
    view.showStage(showContent);
    view.showTopbar(showContent);
  }
  if (finished) {
    view.showOutro();
    if (startedAt !== null) pause();
  }
  if (!force && nextIndex === activeIndex) return;
  activeIndex = nextIndex;
  view.renderTimedBlock(activeIndex, { beforeStart: clock < lines[0].start, finished: clock >= lines.at(-1).end });

}

function renderManual() {
  view.renderSection("");
  if (index === 0) {
    contentVisible = false;
    view.showIntro();
    view.showStage(false);
    view.showTopbar(false);
    view.renderCounter("");
    return;
  }
  if (index > view.getBlocks().length) {
    contentVisible = false;
    view.showOutro();
    return;
  }
  contentVisible = true;
  view.hideIntro();
  view.showStage(true);
  view.showTopbar(true);
  view.renderBlock(index - 1);
}
