import { findHymn } from "../../api/hymnsApi.js";
import { HOME_PATH, MODES } from "../../core/constants.js";
import { navigate } from "../../core/router.js";
import * as audioMode from "./audioMode.js";
import * as lyricsMode from "./lyricsMode.js";
import * as view from "./hymnView.js";

let currentMode = null;
let open = false;
let loadToken = 0;

/**
 * Abre un himno en la ruta /X según el modo recibido.
 */
export async function openHymn(id, mode) {
  const token = ++loadToken;

  stopCurrentMode();

  view.showHymn();
  view.clearNotice();
  view.showTopbar(false);
  view.showStage(false);
  view.showList(false);
  view.showNav(false);
  view.showStartButton(false);
  view.resetIntro();

  const hymn = await findHymn(id);

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

  open = true;
  view.renderNotFound(false);
  view.renderHeader(hymn);

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
  open = false;
}

export function showHome() {
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
  }
}

export function prev() {
  if (currentMode === MODES.LYRICS) {
    lyricsMode.prev();
  }
}

export function togglePlayback() {
  if (isAudioMode()) {
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
  const request = document.fullscreenElement
    ? document.exitFullscreen?.()
    : document.documentElement.requestFullscreen?.();

  //Algunos navegadores rechazan la petición sin gesto del usuario.
  request?.catch(() => {});
}

export function initHymn() {
  view.bindBack(goHome);
  view.bindHome(goHome);
  view.bindFullscreen(toggleFullscreen);
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
