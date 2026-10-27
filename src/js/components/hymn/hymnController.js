import { updateSeo } from "../../services/seoService.js";
import { findHymn } from "../../api/hymnsApi.js";
import { HOME_PATH, MODES, SEEK_STEP } from "../../core/constants.js";
import { navigate } from "../../core/router.js";
import { resetHymnBackground, setHymnBackground } from "../../services/backgroundService.js";
import * as audioMode from "./audioMode.js";
import * as lyricsMode from "./lyricsMode.js";
import * as view from "./hymnView.js";
import { setMode as setSelectorMode } from "../selector/selectorController.js";

let currentMode = null;
let open = false;
let loadToken = 0;

/**
 * Abre un himno en la ruta /X según el modo recibido.
 */
export async function openHymn(id, mode) {
  const token = ++loadToken;

  stopCurrentMode();
  resetHymnBackground();

  const staticHymn = document.getElementById("static-hymn");
  // Conserva la lectura inicial mientras se resuelve el catálogo.
  if (!staticHymn) view.showHymn();
  view.clearNotice();
  view.showTopbar(false);
  view.showStage(false);
  view.showList(false);
  view.showNav(false);
  view.showStartButton(false);
  view.resetIntro();

  let hymn;
  try {
    hymn = await findHymn(id);
  } catch {
    if (token !== loadToken) return;
    if (!staticHymn) view.renderNotice("No se pudo cargar el himno. Inténtalo de nuevo.");
    return;
  }

  //Otra navegación ocurrió mientras cargábamos: descartamos este resultado.
  if (token !== loadToken) {
    return;
  }

  if (!hymn) {
    open = false;
    view.renderNotFound(true);
    view.renderCounter("");
    return;
  }

  updateSeo(hymn);
  open = true;
  setSelectorMode(mode);
  setHymnBackground(hymn);
  view.renderNotFound(false);
  view.renderHeader(hymn);
  if (staticHymn) {
    // Reutiliza la letra en la lista real del reproductor, accesible con L.
    const text = staticHymn.querySelector(".static-lyrics").textContent;
    view.renderLyricsList(text.split(/\r?\n/).map(text => text.trim()).filter(Boolean).map(text => ({ text })));
    staticHymn.remove();
  } else {
    view.renderLyricsList([]);
  }
  view.showHymn();
  view.showIntro();

  if (mode === MODES.LYRICS) {
    currentMode = MODES.LYRICS;
    await lyricsMode.start(hymn);
    return;
  }

  currentMode = mode;
  await audioMode.start(hymn, mode);
}

/**
 * Cierra la vista de himno y detiene cualquier reproducción.
 */
export function closeHymn() {
  loadToken += 1;
  stopCurrentMode();
  resetHymnBackground();
  open = false;
}

export function showHome() {
  document.getElementById("static-hymn")?.remove();
  updateSeo();
  view.showHome();
}

export function isHymnOpen() {
  return open;
}

export function getCurrentMode() {
  return currentMode;
}

export function goHome() {
  navigate(HOME_PATH);
}

export function next() {
  if (currentMode === MODES.LYRICS) {
    lyricsMode.next();
  } else if (isAudioMode()) audioMode.seekBy(SEEK_STEP);
}

export function prev() {
  if (currentMode === MODES.LYRICS) {
    lyricsMode.prev();
  } else if (isAudioMode()) audioMode.seekBy(-SEEK_STEP);
}

export function togglePlayback() {
  if (currentMode === MODES.LYRICS) {
    lyricsMode.togglePlayback();
  } else if (isAudioMode()) {
    audioMode.togglePlayback();
  }
}

export function seekBy(seconds) {
  if (isAudioMode()) {
    audioMode.seekBy(seconds);
  }
}

export function toggleLyricsList() {
  if (isAudioMode()) {
    audioMode.toggleLyricsList();
  }
}

export function toggleFullscreen() {
  if (document.body.classList.contains("is-immersive")) {
    document.body.classList.remove("is-immersive");
    syncFullscreen();
    window.dispatchEvent(new Event("resize"));
    return;
  }
  if (!document.documentElement.requestFullscreen) {
    enterImmersive();
    return;
  }
  const request = document.fullscreenElement
    ? document.exitFullscreen?.()
    : document.documentElement.requestFullscreen();
  request?.catch(() => { if (!document.fullscreenElement) enterImmersive(); });
}

function enterImmersive() {
  document.body.classList.add("is-immersive");
  syncFullscreen();
  window.dispatchEvent(new Event("resize"));
}

export function initHymn() {
  const supported = typeof document.documentElement.requestFullscreen === "function";

  view.setFullscreenAvailable(supported);
  view.bindBack(goHome);
  view.bindHome(goHome);
  view.bindFullscreen(toggleFullscreen);
  view.bindHomeFullscreen(toggleFullscreen);
  view.bindNav({ onPrev: prev, onNext: next });
  view.bindPlayback(togglePlayback);

  document.addEventListener("fullscreenchange", syncFullscreen);
  document.addEventListener("fullscreenchange", syncFullscreenKeyboard);
  syncFullscreen();
}

// Captura únicamente Escape; Tab y el botón permiten salir de pantalla completa.
// Sin soporte o permiso, se conserva el comportamiento nativo del navegador.
async function syncFullscreenKeyboard() {
  if (!navigator.keyboard?.lock) return;
  if (!document.fullscreenElement) {
    navigator.keyboard.unlock();
    return;
  }
  try {
    await navigator.keyboard.lock(["Escape"]);
    // La solicitud puede terminar después de que el usuario haya salido.
    if (!document.fullscreenElement) navigator.keyboard.unlock();
  } catch {
    // El usuario o el navegador pueden rechazar la captura de Escape.
  }
}

function syncFullscreen() {
  view.setFullscreenState(Boolean(document.fullscreenElement) || document.body.classList.contains("is-immersive"),
    Boolean(document.documentElement.requestFullscreen) && !document.body.classList.contains("is-immersive"));
}

function isAudioMode() {
  return currentMode === MODES.SUNG || currentMode === MODES.KARAOKE;
}

function stopCurrentMode() {
  if (currentMode === MODES.LYRICS) {
    lyricsMode.stop();
  } else if (isAudioMode()) {
    audioMode.stop();
  }

  currentMode = null;
}
