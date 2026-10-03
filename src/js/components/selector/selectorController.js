import { DEFAULT_MODE } from "../../core/constants.js";

const selector = document.querySelector(".selector");
const selectorBtn = document.querySelector(".selector-btn");
const opciones = document.querySelectorAll(".opcion");

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
 * Copia el ícono de una opción en el botón principal.
 */
function renderButtonIcon(opcion) {
  const imagen = opcion.querySelector("img");
  const imagenPrincipal = selectorBtn.querySelector("img");

  imagenPrincipal.src = imagen.src;
  imagenPrincipal.alt = imagen.alt;
}

/**
 * Abre o cierra el menú del selector.
 */
function toggleSelector() {
  selector.classList.toggle("abierto");
}

/**
 * Selecciona una opción del menú.
 */
function selectOption(opcion) {
  renderButtonIcon(opcion);
  selector.classList.remove("abierto");

  currentMode = opcion.dataset.value;
}

/**
 * Cierra el selector si se hace clic fuera.
 */
function handleClickOutside(event) {
  if (!selector.contains(event.target)) {
    selector.classList.remove("abierto");
  }
}

/**
 * Inicializa el componente selector.
 */
export function initSelector() {
  const defaultOption = [...opciones].find(
    (opcion) => opcion.dataset.value === DEFAULT_MODE,
  );

  if (defaultOption) {
    renderButtonIcon(defaultOption);
  }

  selectorBtn.addEventListener("click", toggleSelector);

  opciones.forEach((opcion) => {
    opcion.addEventListener("click", () => {
      selectOption(opcion);
    });
  });

  document.addEventListener("click", handleClickOutside);
}
