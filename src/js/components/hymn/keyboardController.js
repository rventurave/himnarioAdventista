import { HOME_PATH, MODES, SEEK_STEP } from "../../core/constants.js";
import { navigate } from "../../core/router.js";
import {
  getCurrentMode,
  isHymnOpen,
  next,
  prev,
  seekBy,
  toggleFullscreen,
  toggleLyricsList,
  togglePlayback,
} from "./hymnController.js";

function isTyping(target) {
  if (!target) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function handleKeydown(event) {
  if (isTyping(event.target)) {
    return;
  }

  const key = event.key;

  if (key === "Escape") {
    //En pantalla completa, Escape primero sale de ella (lo maneja el navegador).
    if (document.fullscreenElement) {
      return;
    }

    if (window.location.pathname !== HOME_PATH) {
      event.preventDefault();
      navigate(HOME_PATH);
    }
    return;
  }

  if (key === "f" || key === "F") {
    if (isHymnOpen()) {
      event.preventDefault();
      toggleFullscreen();
    }
    return;
  }

  if (!isHymnOpen()) {
    return;
  }

  const mode = getCurrentMode();

  if (key === "l" || key === "L") {
    if (mode !== MODES.LYRICS) {
      event.preventDefault();
      toggleLyricsList();
    }
    return;
  }

  if (mode === MODES.LYRICS) {
    if (key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (key === "ArrowLeft") {
      event.preventDefault();
      prev();
    }
    return;
  }

  if (key === " " || key === "Spacebar") {
    event.preventDefault();
    togglePlayback();
  } else if (key === "ArrowRight") {
    event.preventDefault();
    seekBy(SEEK_STEP);
  } else if (key === "ArrowLeft") {
    event.preventDefault();
    seekBy(-SEEK_STEP);
  }
}

export function initKeyboard() {
  document.addEventListener("keydown", handleKeydown);
}
