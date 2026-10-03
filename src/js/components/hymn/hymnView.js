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

const audioElement = document.querySelector("#hymn-audio");
const startButton = document.querySelector("#hymn-start");
const stateIconElement = document.querySelector("#hymn-state-icon");

const backButton = document.querySelector("#hymn-back");
const fullscreenButton = document.querySelector("#hymn-fullscreen");
const homeButton = document.querySelector("#hymn-home");

let activeListIndex = -1;
let introHideTimer = null;
let stateIconTimer = null;

export function showHome() {
  homeView.hidden = false;
  hymnView.hidden = true;
}

export function showHymn() {
  homeView.hidden = true;
  hymnView.hidden = false;
}

//Rellena la barra superior y la presentación inicial.
export function renderHeader(hymn) {
  numberElement.textContent = `#${hymn.number}`;
  titleElement.textContent = hymn.title;
  referenceElement.textContent = hymn.bibleReference || "";

  introNumberElement.textContent = `#${hymn.number}`;
  introTitleElement.textContent = hymn.title;
}

export function showTopbar(visible) {
  topbarElement.hidden = !visible;
}

/* ========================================
   PRESENTACIÓN INICIAL (NÚMERO + TÍTULO)
======================================== */

export function showIntro() {
  clearTimeout(introHideTimer);

  introElement.hidden = false;

  //Fuerza un reflow para que la transición se reproduzca.
  void introElement.offsetWidth;
  introElement.classList.add("visible");
}

export function hideIntro() {
  introElement.classList.remove("visible");

  clearTimeout(introHideTimer);
  introHideTimer = setTimeout(() => {
    if (!introElement.classList.contains("visible")) {
      introElement.hidden = true;
    }
  }, 500);
}

//Oculta la presentación sin animación (al cambiar de himno o de ruta).
export function resetIntro() {
  clearTimeout(introHideTimer);
  introElement.classList.remove("visible");
  introElement.hidden = true;
}

/* ========================================
   LETRA
======================================== */

//Muestra la frase actual y, tenue, la siguiente.
export function renderSection(label) {
  sectionElement.textContent = label;
  sectionElement.hidden = !label;
}

export function renderSlide(current, next = "", previous = "") {
  previousElement.textContent = previous;
  previousElement.hidden = !previous;
  currentElement.textContent = current || "";
  nextElement.textContent = next || "";
  nextElement.hidden = !next;

  //Reinicia la animación de entrada de la frase actual.
  currentElement.classList.remove("lyric-enter");
  void currentElement.offsetWidth;
  currentElement.classList.add("lyric-enter");
}

export function showStage(visible) {
  stageElement.hidden = !visible;
}

export function renderCounter(text) {
  counterElement.textContent = text || "";
  counterElement.hidden = !text;
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
  listElement.hidden = !visible;

  if (!visible) {
    listElement.innerHTML = "";
    activeListIndex = -1;
  }
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

export function bindNav({ onPrev, onNext }) {
  prevButton.addEventListener("click", onPrev);
  nextButton.addEventListener("click", onNext);
}
