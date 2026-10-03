import { getSlides } from "../../services/lyricsService.js";
import * as view from "./hymnView.js";

/*
 * índice 0 = presentación (número + título)
 * índice 1..N = fragmentos de la letra
 */
let slides = [];
let index = 0;
let navBound = false;

/**
 * Inicia el modo Solo letra: sin audio, navegando fragmento a fragmento.
 * Empieza siempre en la presentación y espera al usuario.
 */
export async function start(hymn) {
  view.showList(false);
  view.showStage(false);
  view.showNav(true);
  view.showTopbar(false);
  view.renderSlide("", "");
  view.renderCounter("");
  view.showIntro();

  slides = await getSlides(hymn);
  index = 0;

  if (!slides.length) {
    view.hideIntro();
    view.showTopbar(true);
    view.showStage(true);
    view.showNav(false);
    view.renderSlide("Letra no disponible", "");
    view.renderNotice("No se encontró la letra de este himno.");
    return;
  }

  if (!navBound) {
    view.bindNav({ onPrev: prev, onNext: next });
    navBound = true;
  }

  render();
}

export function next() {
  if (index >= slides.length) {
    return;
  }

  index += 1;
  render();
}

export function prev() {
  if (index <= 0) {
    return;
  }

  index -= 1;
  render();
}

export function stop() {
  slides = [];
  index = 0;
}

function render() {
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

  view.renderSlide(slides[index - 1], slides[index] || "");
  view.renderCounter(`${index} / ${slides.length}`);
}
