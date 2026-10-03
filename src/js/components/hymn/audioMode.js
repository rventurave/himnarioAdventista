import { findActiveIndex } from "../../utils/lyricsTimeline.js";
import { getHymnAudioUrl } from "../../api/hymnsApi.js";
import { MODES } from "../../core/constants.js";
import { getSlides, getPlaybackLyrics } from "../../services/lyricsService.js";
import * as view from "./hymnView.js";

const audio = view.getAudioElement();

/*
 * Presentación de respaldo cuando no hay tiempos ni audio.
 * Con sincronización, la primera frase determina el fin de la presentación.
 */
const INTRO_SECONDS = 5;

//La letra se adelanta al audio: la frase se muestra 1 s antes de cantarse.
const LYRICS_LEAD_SECONDS = 1;

let loadToken = 0;
let analysisController = null;
let lines = [];
let activeIndex = -1;
let listView = false;
let listenersBound = false;
let pendingSeek = null;

let syncedMode = false;
let hasLyrics = false;
let introReady = false;
let state = "idle"; // "intro" | "content"
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
  if (playback.lines.length) {
    syncedMode = true;
    lines = playback.lines;
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
}

export function togglePlayback() {
  if (!audio.src || !introReady) {
    return;
  }

  if (audio.paused) {
    audio.play().catch(() => {});
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
  if (state !== "intro" || !introReady) {
    return;
  }

  if (audio.currentTime >= introEnd) {
    enterContent();
  }
}

function enterContent() {
  if (state === "content") {
    return;
  }

  state = "content";
  clearIntroTimer();

  view.hideIntro();
  view.showTopbar(true);
  view.showStartButton(false);

  if (syncedMode) {
    view.showStage(true);
    view.showList(false);
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
  try {
    const playback = audio.play();

    if (playback && typeof playback.catch === "function") {
      playback.catch(() => {
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
  const line = lines[activeIndex];
  const clock = audio.currentTime + LYRICS_LEAD_SECONDS;
  const next = activeIndex < 0
    ? lines.find(item => item.start > clock)
    : lines[activeIndex + 1];
  view.renderSection(line ? (line.type === "chorus" ? "Coro" : `Estrofa ${line.verse}`) : "");
  view.renderSlide(line?.text || "", next?.text || "", lines[activeIndex - 1]?.text || "");

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

//Respaldo cuando no se pueden obtener tiempos: letra completa sin resaltado.
async function prepareUnsyncedContent(hymn, token) {
  const slides = await getSlides(hymn);

  if (token !== loadToken) return;
  hasLyrics = slides.length > 0;

  if (hasLyrics) {
    view.renderLyricsList(
      slides.map((text) => ({ text })),
      -1,
    );
    listView = true;
  }
}
