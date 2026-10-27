import { createBlockPresentation } from "./blockPresentation.js";

const homeView = document.querySelector("#view-home");
const hymnView = document.querySelector("#view-hymn");

const topbarElement = document.querySelector("#hymn-topbar");
const numberElement = document.querySelector("#hymn-number");
const titleElement = document.querySelector("#hymn-title");
const referenceElement = document.querySelector("#hymn-reference");

const noticeElement = document.querySelector("#hymn-notice");
const contentElement = document.querySelector("#hymn-content");
const notFoundElement = document.querySelector("#hymn-notfound");

const introElement = document.querySelector("#hymn-intro");
const introNumberElement = document.querySelector("#intro-number");
const introTitleElement = document.querySelector("#intro-title");

// Reutiliza el marcado existente, también en los 613 HTML prerenderizados.
function separator(id) {
  const element = document.createElement("span");
  element.id = id;
  element.className = "hymn-separator";
  element.textContent = "|";
  element.setAttribute("aria-hidden", "true");
  return element;
}
const referenceSeparator = separator("reference-separator");
numberElement.after(referenceSeparator);
referenceSeparator.after(referenceElement);
titleElement.hidden = true;
const introComposition = document.createElement("div");
introComposition.className = "intro-composition";
introElement.appendChild(introComposition);
introComposition.append(introNumberElement, separator("intro-separator"), introTitleElement);

const stageElement = document.querySelector("#lyrics-stage");
const sectionElement = document.querySelector("#lyric-section");
const previousElement = document.querySelector("#lyric-previous");
const currentElement = document.querySelector("#lyric-current");
const nextElement = document.querySelector("#lyric-next");
const listElement = document.querySelector("#lyrics-list");

const navElement = document.querySelector("#hymn-nav");
const counterElement = document.querySelector("#hymn-counter");
const prevButton = document.querySelector("#hymn-prev");
const nextButton = document.querySelector("#hymn-next");
const navCenter = document.createElement("div");
navCenter.className = "hymn-nav-center";
counterElement.before(navCenter);
const navReference = document.createElement("div");
navReference.className = "hymn-nav-reference";
navReference.append(numberElement, referenceSeparator, referenceElement);
navCenter.before(navReference);
const playbackButton = document.createElement("button");
playbackButton.id = "hymn-playback";
playbackButton.className = "hymn-arrow";
playbackButton.type = "button";
playbackButton.hidden = true;
navCenter.append(playbackButton, counterElement);
setPlaybackState(false);


const audioElement = document.querySelector("#hymn-audio");
const startButton = document.querySelector("#hymn-start");
const stateIconElement = document.querySelector("#hymn-state-icon");

const backButton = document.querySelector("#hymn-back");
const fullscreenButton = document.querySelector("#hymn-fullscreen");
const homeFullscreenButton = document.querySelector("#home-fullscreen");
const homeButton = document.querySelector("#hymn-home");

const presentation = createBlockPresentation({ stage: stageElement, current: currentElement,
  previous: previousElement, next: nextElement, content: contentElement, topbar: topbarElement,
  notice: noticeElement, nav: navElement,
  onLabel: (label, counter) => { renderSection(label); renderCounter(counter); },
});

export function prepareBlocks(structure, timeline = []) { return presentation.prepare(structure, timeline); }
export function getBlocks() { return presentation.blocks; }
export function getBlockIndex() { return presentation.index; }
export function renderBlock(index, instant = false) { presentation.show(index, -1, instant); }
export function renderTimedBlock(index, state) { presentation.timed(index, state); }
export function clearBlocks() { presentation.clear(); }
export function relayoutBlocks() { presentation.relayout(); }

let activeListIndex = -1;
let stateIconTimer = null;

export function showHome() {
  homeView.hidden = false;
  hymnView.hidden = true;
  document.body.classList.add("home-open");
}

export function showHymn() {
  homeView.hidden = true;
  hymnView.hidden = false;
  document.body.classList.remove("home-open");
}

//Rellena la referencia de los controles y la presentación inicial.
export function renderHeader(hymn) {
  numberElement.textContent = String(hymn.number);
  titleElement.textContent = hymn.title;
  referenceElement.textContent = hymn.bibleReference || "";
  referenceSeparator.hidden = !hymn.bibleReference;

  introNumberElement.textContent = String(hymn.number);
  introTitleElement.textContent = hymn.title;
}

export function showTopbar(visible) {
  topbarElement.hidden = !visible && introElement.hidden;
}

/* ========================================
   PRESENTACIÓN INICIAL (NÚMERO + TÍTULO)
======================================== */

export function showIntro() {
  clearTimeout(stateIconTimer);
  stateIconElement.classList.remove("visible");
  stateIconElement.hidden = true;
  // Cancela el bloque transitorio; la letra completa permanece en la lista.
  presentation.show(-1, -1, true);
  introElement.hidden = false;
  topbarElement.classList.add("is-cover");
  topbarElement.hidden = false;
  sectionElement.hidden = true;
  counterElement.hidden = true;

  //Fuerza un reflow para que la transición se reproduzca.
  void introElement.offsetWidth;
  introElement.classList.add("visible");
  fitIntroTitle();
}

export function hideIntro() {
  // La letra entrante nunca se superpone con la portada saliente.
  resetIntro();
}

function fitIntroTitle() {
  if (introElement.hidden) return;
  const content = contentElement.getBoundingClientRect();
  const header = topbarElement.getBoundingClientRect();
  const controls = [navElement, startButton].filter(element => !element.hidden).map(element => element.getBoundingClientRect().top);
  introElement.style.top = `${Math.max(0, header.bottom - content.top + 8)}px`;
  introElement.style.bottom = `${controls.length ? Math.max(0, content.bottom - Math.min(...controls) + 8) : 0}px`;
  introComposition.style.fontSize = "";
  const base = parseFloat(getComputedStyle(introTitleElement).fontSize);
  let size = base;
  // Permite varias líneas legibles; reduce solo si excede el área de la portada.
  for (let i = 0; i < 30; i++) {
    const area = getComputedStyle(introElement);
    const available = introElement.clientHeight - parseFloat(area.paddingTop) - parseFloat(area.paddingBottom);
    if (introTitleElement.scrollHeight <= available + 1 &&
        introTitleElement.scrollWidth <= introTitleElement.clientWidth + 1) break;
    size *= 0.95;
    introComposition.style.fontSize = `${size}px`;
  }
}
let introLayoutFrame;
function scheduleIntroLayout() {
  cancelAnimationFrame(introLayoutFrame);
  introLayoutFrame = requestAnimationFrame(fitIntroTitle);
}
window.addEventListener("resize", scheduleIntroLayout);
window.visualViewport?.addEventListener("resize", scheduleIntroLayout);
document.addEventListener("fullscreenchange", scheduleIntroLayout);
document.fonts?.addEventListener("loadingdone", scheduleIntroLayout);
const introObserver = new ResizeObserver(scheduleIntroLayout);
for (const element of [contentElement, topbarElement, navElement, startButton]) introObserver.observe(element);

export function showOutro() {
  showTopbar(false);
  showStage(false);
  showList(false);
  showStartButton(false);
  renderSection("");
  renderCounter("");
  showIntro();
}

//Oculta la presentación sin animación (al cambiar de himno o de ruta).
export function resetIntro() {
  introElement.classList.remove("visible");
  introElement.hidden = true;
  if (topbarElement.classList.contains("is-cover")) topbarElement.hidden = true;
  topbarElement.classList.remove("is-cover");
}

/* ========================================
   LETRA
======================================== */

//Muestra la frase actual y, tenue, la siguiente.
export function renderSection(label) {
  sectionElement.textContent = label;
  sectionElement.hidden = !label || !introElement.hidden;
}

export function renderSlide(current, next = "", previous = "") {
  previousElement.textContent = previous;
  previousElement.hidden = !previous;
  currentElement.textContent = current || "";
  nextElement.textContent = next || "";
  nextElement.hidden = !next;


}

export function showStage(visible) {
  stageElement.hidden = !visible;
}

export function renderCounter(text) {
  counterElement.textContent = text || "";
  counterElement.hidden = !text || !introElement.hidden;
}

export function showNav(visible) {
  navElement.hidden = !visible;
}

export function renderLyricsList(lines, activeIndex = -1) {
  listElement.innerHTML = "";
  activeListIndex = -1;

  (lines || []).forEach((line, index) => {
    const item = document.createElement("li");

    item.className = "lyric-line";
    item.textContent = line.text;
    item.dataset.index = String(index);

    listElement.appendChild(item);
  });

  setActiveLine(activeIndex);
}

export function showList(visible) {
  // Ocultar la vista no debe borrar la letra que ya se ha cargado.
  listElement.hidden = !visible;
}

export function hasLyricsList() {
  return listElement.children.length > 0;
}

//Resalta la línea activa y la mantiene visible (auto scroll).
export function setActiveLine(index) {
  const items = listElement.querySelectorAll(".lyric-line");

  if (index === activeListIndex && items[index]) {
    return;
  }

  items.forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });

  activeListIndex = index;

  const active = items[index];

  if (active) {
    active.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

export function onLineClick(callback) {
  listElement.addEventListener("click", (event) => {
    const item = event.target.closest(".lyric-line");

    if (item) {
      callback(Number(item.dataset.index));
    }
  });
}

/* ========================================
   AVISOS Y ERRORES
======================================== */

export function renderNotice(message) {
  noticeElement.textContent = message || "";
  noticeElement.hidden = !message;
}

export function clearNotice() {
  renderNotice("");
}

export function renderNotFound(show) {
  notFoundElement.hidden = !show;
  contentElement.hidden = show;

  if (show) {
    showTopbar(false);
    showNav(false);
    showStartButton(false);
    resetIntro();
  }
}

/* ========================================
   AUTOPLAY BLOQUEADO
======================================== */

export function showStartButton(visible) {
  startButton.hidden = !visible;
}

export function bindStart(handler) {
  startButton.addEventListener("click", handler);
}

//Indicador momentáneo de play/pausa (Space).
export function flashState(symbol) {
  if (!introElement.hidden) return;
  clearTimeout(stateIconTimer);

  stateIconElement.textContent = symbol;
  stateIconElement.hidden = false;

  void stateIconElement.offsetWidth;
  stateIconElement.classList.add("visible");

  stateIconTimer = setTimeout(() => {
    stateIconElement.classList.remove("visible");
    stateIconTimer = setTimeout(() => {
      stateIconElement.hidden = true;
    }, 250);
  }, 600);
}

/* ========================================
   AUDIO Y EVENTOS
======================================== */

export function getAudioElement() {
  return audioElement;
}

export function bindBack(handler) {
  backButton.addEventListener("click", handler);
}

export function bindHome(handler) {
  homeButton.addEventListener("click", handler);
}

export function bindFullscreen(handler) {
  fullscreenButton.addEventListener("click", handler);
}

export function bindHomeFullscreen(handler) {
  homeFullscreenButton.addEventListener("click", handler);
}

//Sincroniza el estado visual de ambos botones de pantalla completa.
export function setFullscreenState(active, native = true) {
  for (const button of [homeFullscreenButton, fullscreenButton]) {
    button.classList.toggle("is-fullscreen", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", native
      ? (active ? "Salir de pantalla completa" : "Pantalla completa")
      : (active ? "Salir de vista ampliada" : "Vista ampliada"));
  }
  homeFullscreenButton.textContent = "⛶";
}

// Ofrece la vista ampliada cuando el navegador no soporta la Fullscreen API.
export function setFullscreenAvailable(available) {
  homeFullscreenButton.hidden = false;
  fullscreenButton.hidden = false;
  setFullscreenState(false, available);
}

export function setPlaybackAvailable(available) { playbackButton.hidden = !available; }
export function setPlaybackState(playing) {
  playbackButton.textContent = playing ? "⏸" : "▶";
  playbackButton.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
  playbackButton.setAttribute("aria-pressed", String(playing));
}
export function bindPlayback(handler) { playbackButton.addEventListener("click", handler); }

export function bindNav({ onPrev, onNext }) {
  prevButton.addEventListener("click", onPrev);
  nextButton.addEventListener("click", onNext);
}
