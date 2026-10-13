import { getSlides, getPlaybackLyrics } from "../../services/lyricsService.js";
import { findActiveIndex } from "../../utils/lyricsTimeline.js";
import { LYRICS_LEAD_SECONDS } from "../../core/constants.js";
import * as view from "./hymnView.js";

let slides = [];
let index = 0; // Presentación = 0, fragmentos manuales = 1..N.
let lines = [];
let activeIndex = -1;
let navBound = false;
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
  view.showTopbar(false);
  view.renderSlide("", "");
  view.renderCounter("");
  view.renderSection("");
  view.showIntro();
  view.renderNotice("Preparando sincronización…");

  if (!navBound) {
    view.bindNav({ onPrev: prev, onNext: next });
    navBound = true;
  }

  let playback;
  try {
    playback = await getPlaybackLyrics(hymn, controller.signal, { allowAudioAnalysis: false });
  } catch {
    playback = { lines: [] };
  }
  if (token !== loadToken) return;

  if (playback.lines.length) {
    lines = playback.lines;
    view.showNav(true);
    view.renderNotice(playback.estimated ? "Avance automático con tiempos aproximados." : "");
    resume();
    renderTimed(true);
    return;
  }

  const fallbackSlides = await getSlides(hymn);
  if (token !== loadToken) return;
  slides = fallbackSlides;
  if (!slides.length) {
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
  if (lines.length) {
    const clock = currentTime() + LYRICS_LEAD_SECONDS;
    const target = lines.findIndex(line => line.start > clock + 0.000001);
    if (target >= 0) seekToLine(target);
    return;
  }
  if (index < slides.length) {
    index += 1;
    renderManual();
  }
}

export function prev() {
  if (lines.length) {
    const clock = currentTime() + LYRICS_LEAD_SECONDS;
    let target = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].start < clock - 0.000001) target = i;
    }
    // Durante una frase, la flecha retrocede a la frase anterior.
    if (target === findActiveIndex(lines, clock)) target -= 1;
    if (target >= 0) seekToLine(target);
    else seekTo(0);
    return;
  }
  if (index > 0) {
    index -= 1;
    renderManual();
  }
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
  slides = [];
  index = 0;
  activeIndex = -1;
  contentVisible = false;
  view.renderSection("");
}

function currentTime() {
  return elapsed + (startedAt === null ? 0 : (performance.now() - startedAt) / 1000);
}

function resume() {
  startedAt = performance.now();
  timer = setInterval(() => renderTimed(false), 100);
}

function pause() {
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
  const showContent = clock >= lines[0].start;
  if (showContent !== contentVisible) {
    contentVisible = showContent;
    if (showContent) view.hideIntro();
    else view.showIntro();
    view.showStage(showContent);
    view.showTopbar(showContent);
  }
  if (clock >= lines.at(-1).end && startedAt !== null) pause();
  if (!force && nextIndex === activeIndex) return;
  activeIndex = nextIndex;
  const line = lines[activeIndex];
  const upcoming = line ? lines[activeIndex + 1] : lines.find(item => item.start > clock);
  view.renderSection(line ? (line.type === "chorus" ? "Coro" : `Estrofa ${line.verse}`) : "");
  view.renderSlide(line?.text || "", upcoming?.text || "", lines[activeIndex - 1]?.text || "");
  view.renderCounter(line ? `${activeIndex + 1} / ${lines.length}` : "");
}

function renderManual() {
  view.renderSection("");
  if (index === 0) {
    view.showIntro();
    view.showStage(false);
    view.showTopbar(false);
    view.renderCounter("");
    return;
  }
  view.hideIntro();
  view.showStage(true);
  view.showTopbar(true);
  view.renderSlide(slides[index - 1], slides[index] || "", slides[index - 2] || "");
  view.renderCounter(`${index} / ${slides.length}`);
}
