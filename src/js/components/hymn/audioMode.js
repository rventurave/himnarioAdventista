import { findActiveIndex } from "../../utils/lyricsTimeline.js";
import { getHymnAudioUrl } from "../../api/hymnsApi.js";
import { MODES, LYRICS_LEAD_SECONDS } from "../../core/constants.js";
import { getSlides, getPlaybackLyrics, getStructuredLyrics } from "../../services/lyricsService.js";
import * as view from "./hymnView.js";

const audio = view.getAudioElement();

/*
 * Presentación de respaldo cuando no hay tiempos ni audio.
 * Con sincronización, la primera frase determina el fin de la presentación.
 */
const INTRO_SECONDS = 5;

let loadToken = 0;
let analysisController = null;
let lines = [];
let activeIndex = -1;
let listView = false;
let listenersBound = false;
let pendingSeek = null;
let audioFailed = false;

let syncedMode = false;
let hasLyrics = false;
let introReady = false;
let state = "idle"; // "intro" | "content" | "outro"
let introEnd = INTRO_SECONDS;
let introTimer = null;

/**
 * Inicia el modo Cantado o Karaoke: audio oculto + letra sincronizada.
 * Ambos modos comparten exactamente la misma sincronización (LRC o estimación acústica).
 */
export async function start(hymn, mode) {
  const token = ++loadToken;
  analysisController?.abort();
  analysisController = new AbortController();
  clearIntroTimer();
  resetAudio();
  audioFailed = false;
  view.renderSection("");

  lines = [];
  activeIndex = -1;
  listView = false;
  pendingSeek = null;
  syncedMode = false;
  hasLyrics = false;
  introReady = false;
  state = "intro";
  introEnd = INTRO_SECONDS;

  view.showTopbar(false);
  view.showStage(false);
  view.showList(false);
  view.showNav(false);
  view.setPlaybackAvailable(false);
  view.showStartButton(false);
  view.clearNotice();
  view.showIntro();

  bindListeners();

  const url = getHymnAudioUrl(
    hymn,
    mode === MODES.KARAOKE ? "instrumental" : "musica",
  );

  if (!url) {
    resetAudio();

    view.renderNotice(
      mode === MODES.KARAOKE
        ? "Este himno no tiene audio instrumental disponible."
        : "Este himno no tiene audio cantado disponible.",
    );

    await prepareUnsyncedContent(hymn, token);
    if (token !== loadToken) return;
    introReady = true;
    scheduleIntroEnd();
    return;
  }

  //Prepara el audio, pero espera los tiempos para no perder las primeras frases.
  audio.src = url;
  audio.load();

  view.renderNotice("Preparando sincronización…");
  let playback;
  try {
    playback = await getPlaybackLyrics(hymn, analysisController.signal);
  } catch {
    playback = { lines: [] };
  }
  if (token !== loadToken) return;
  const structure = await getStructuredLyrics(hymn);
  if (token !== loadToken) return;
  view.prepareBlocks(structure, playback.lines);
  if (audioFailed) {
    await prepareUnsyncedContent(hymn, token);
    if (token !== loadToken) return;
    introReady = true;
    enterContent();
    return;
  }
  if (playback.lines.length) {
    syncedMode = true;
    lines = playback.lines;
    // La letra completa permanece en el DOM antes de pulsar L o iniciar el audio.
    view.renderLyricsList(lines, activeIndex);
    introEnd = Math.max(0, lines[0].start - LYRICS_LEAD_SECONDS);
    //La advertencia depende del método: con alineación vocal real no se muestra.
    view.renderNotice(playback.syncMethod === "estimated"
      ? "Sincronización aproximada según el audio. Para precisión vocal se requieren tiempos revisados."
      : "");
    updateActiveLine(true);
  } else {
    view.renderNotice("No se pudo sincronizar este audio. Letra completa disponible.");
    await prepareUnsyncedContent(hymn, token);
    if (token !== loadToken) return;
  }

  introReady = true;
  view.showNav(true);
  view.setPlaybackAvailable(true);

  maybeEnterContent();
  attemptAutoplay();
}

export function stop() {
  loadToken++;
  analysisController?.abort();
  view.renderSection("");
  clearIntroTimer();
  resetAudio();

  lines = [];
  activeIndex = -1;
  listView = false;
  syncedMode = false;
  hasLyrics = false;
  introReady = false;
  state = "idle";
  view.clearBlocks();
}

export function togglePlayback() {
  if (!audio.src || !introReady) {
    return;
  }

  if (audio.paused) {
    attemptAutoplay();
    view.flashState("▶");
  } else {
    audio.pause();
    view.flashState("⏸");
  }
}

export function seekBy(seconds) {
  if (!audio.src || !Number.isFinite(audio.duration)) {
    return;
  }

  const target = audio.currentTime + seconds;

  seekTo(Math.min(Math.max(0, target), audio.duration));
}

//Alterna entre "frase actual" y la letra completa resaltada.
export function toggleLyricsList() {
  if (!lines.length || state !== "content") {
    return;
  }

  listView = !listView;

  if (listView) {
    view.showStage(false);
    view.showList(true);
    view.renderLyricsList(lines, activeIndex);
    return;
  }

  view.showList(false);
  view.showStage(true);
  renderActive();
}

/* ========================================
   PRESENTACIÓN INICIAL
======================================== */

function maybeEnterContent() {
  if (state === "idle" || !introReady || audioFailed) return;
  if (audio.ended || (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration)) {
    if (state !== "outro") {
      state = "outro";
      clearIntroTimer();
      view.showOutro();
    }
    return;
  }
  if (audio.currentTime < introEnd) {
    if (state !== "intro") {
      state = "intro";
      view.showTopbar(false);
      view.showStage(false);
      view.showList(false);
      view.renderSection("");
      view.showIntro();
    }
    return;
  }
  enterContent();
}

function enterContent() {
  if (state === "content" && !audioFailed) {
    return;
  }

  state = "content";
  clearIntroTimer();

  view.hideIntro();
  view.showTopbar(true);
  view.showStartButton(false);

  // Un fallo tardío también debe sustituir la vista de frases por la letra
  // completa, aunque ya haya terminado la presentación inicial.
  if (audioFailed && (lines.length || hasLyrics || view.hasLyricsList())) {
    if (lines.length) view.renderLyricsList(lines, -1);
    hasLyrics = true;
    listView = true;
    view.renderSection("");
    view.showStage(false);
    view.showList(true);
    return;
  }

  if (syncedMode) {
    view.showStage(!listView);
    view.showList(listView);
    updateActiveLine(true);
    return;
  }

  if (hasLyrics) {
    view.showStage(false);
    view.showList(true);
    return;
  }

  view.showStage(true);
  view.renderSlide("Letra no disponible", "");
}

//Cuando no hay audio que marque el tiempo, cerramos el intro por reloj.
function scheduleIntroEnd() {
  clearIntroTimer();

  introTimer = setTimeout(() => {
    introTimer = null;
    enterContent();
  }, INTRO_SECONDS * 1000);
}

function clearIntroTimer() {
  if (introTimer !== null) {
    clearTimeout(introTimer);
    introTimer = null;
  }
}

/* ========================================
   AUTOPLAY
======================================== */

function attemptAutoplay() {
  const token = loadToken;
  try {
    const playback = audio.play();

    if (playback && typeof playback.catch === "function") {
      playback.catch((error) => {
        if (token !== loadToken || error.name === "AbortError") return;
        if (error.name !== "NotAllowedError") {
          handleAudioError();
          return;
        }
        //Autoplay bloqueado: ofrecemos un botón,sin romper nada.
        if (state !== "idle") {
          view.showStartButton(true);
        }
      });
    }
  } catch {
    if (state !== "idle") {
      view.showStartButton(true);
    }
  }
}

function handleStart() {
  view.showStartButton(false);
  attemptAutoplay();
}

/* ========================================
   SINCRONIZACIÓN
======================================== */

function bindListeners() {
  if (listenersBound) {
    return;
  }

  audio.addEventListener("error", () => {
    if (audio.hasAttribute("src") && audio.error && state !== "idle") handleAudioError();
  });

  audio.addEventListener("play", maybeEnterContent);
  audio.addEventListener("playing", () => { if (state !== "idle") view.setPlaybackState(true); });
  audio.addEventListener("pause", () => { if (state !== "idle") view.setPlaybackState(false); });
  audio.addEventListener("ended", () => { if (state !== "idle") view.setPlaybackState(false); });

  audio.addEventListener("timeupdate", () => {
    maybeEnterContent();
    updateActiveLine(false);
  });

  for (const event of ["seeking", "seeked", "ended", "durationchange"]) {
    audio.addEventListener(event, () => {
      maybeEnterContent();
      updateActiveLine(true);
    });
  }

  audio.addEventListener("loadedmetadata", () => {
    if (pendingSeek !== null) {
      audio.currentTime = pendingSeek;
      pendingSeek = null;
      updateActiveLine(true);
    }
  });

  view.onLineClick(handleLineClick);
  view.bindStart(handleStart);

  listenersBound = true;
}

function handleLineClick(index) {
  const line = lines[index];

  if (syncedMode && line) {
    //Se adelanta el salto para que la frase pulsada quede visible de inmediato.
    seekTo(Math.max(0, line.start - LYRICS_LEAD_SECONDS));
  }
}

//Salta a un tiempo; si el audio aún no tiene metadatos, lo deja pendiente.
function seekTo(time) {
  if (audio.readyState === 0) {
    pendingSeek = time;
    return;
  }

  audio.currentTime = time;
  maybeEnterContent();
  updateActiveLine(true);
}

function updateActiveLine(force) {
  if (!lines.length) {
    return;
  }

  if (Number.isFinite(audio.duration)) {
    const last = lines[lines.length - 1];
    if (!Number.isFinite(last.end)) last.end = audio.duration;
  }

  const index = audio.ended || (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration)
    ? -1
    : findActiveIndex(lines, audio.currentTime + LYRICS_LEAD_SECONDS);

  if (!force && index === activeIndex) {
    return;
  }

  activeIndex = index;
  renderActive();
}

function renderActive() {
  if (state !== "content") return;
  const clock = audio.currentTime + LYRICS_LEAD_SECONDS;
  view.renderTimedBlock(activeIndex, {
    beforeStart: clock < lines[0]?.start,
    finished: audio.ended || clock >= lines.at(-1)?.end,
  });

  if (listView) {
    view.setActiveLine(activeIndex);
  }
}

/* ========================================
   AUDIO
======================================== */

//Detiene y libera el audio actual sin dejar errores en consola.
function resetAudio() {
  audio.pause();

  if (audio.hasAttribute("src")) {
    try {
      audio.currentTime = 0;
    } catch {
      //Ignoramos: algunos navegadores no permiten fijar el tiempo sin metadatos.
    }

    audio.removeAttribute("src");
    audio.load();
  }

  pendingSeek = null;
  activeIndex = -1;
}

function handleAudioError() {
  audioFailed = true;
  view.setPlaybackAvailable(false);
  audio.pause();
  view.showStartButton(false);
  view.renderNotice("No se pudo reproducir el audio. Comprueba tu conexión o la disponibilidad del archivo.");
  if (introReady) enterContent();
}

//Respaldo cuando no se pueden obtener tiempos: letra completa sin resaltado.
async function prepareUnsyncedContent(hymn, token) {
  const slides = await getSlides(hymn);

  if (token !== loadToken) return;
  // Si también falla la descarga TXT, conserva la letra del HTML inicial.
  hasLyrics = slides.length > 0 || view.hasLyricsList();

  if (slides.length) {
    view.renderLyricsList(
      slides.map((text) => ({ text })),
      -1,
    );
  }
  if (hasLyrics) listView = true;
}
