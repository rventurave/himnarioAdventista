import { DEFAULT_MODE } from "../../core/constants.js";

const opciones = [...document.querySelectorAll(".opcion")];

/*
 * Modo activo del selector.
 * "lyrics" = solo letra, "sung" = audio cantado, "karaoke" = audio instrumental.
 */
let currentMode = DEFAULT_MODE;

/**
 * Devuelve el modo seleccionado actualmente.
 */
export function getMode() {
  return currentMode;
}

/**
 * Actualiza el estado visual y accesible de la opción activa.
 */
function renderActive(mode) {
  opciones.forEach((opcion) => {
    const active = opcion.dataset.value === mode;
    opcion.classList.toggle("active", active);
    opcion.setAttribute("aria-pressed", String(active));
  });
}

/**
 * Sincroniza el selector cuando el modo cambia desde la URL o el router.
 */
export function setMode(mode) {
  if (!opciones.some((opcion) => opcion.dataset.value === mode)) {
    return;
  }

  currentMode = mode;
  renderActive(mode);
}

/**
 * Selecciona una opción del selector.
 */
function selectOption(opcion) {
  setMode(opcion.dataset.value);
}

/**
 * Inicializa el componente selector.
 */
export function initSelector() {
  renderActive(currentMode);

  opciones.forEach((opcion) => {
    opcion.addEventListener("click", () => selectOption(opcion));
  });
}
