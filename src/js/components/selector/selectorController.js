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
  selectorBtn.setAttribute("aria-expanded", String(selector.classList.contains("abierto")));
}

/**
 * Selecciona una opción del menú.
 */
function selectOption(opcion) {
  renderButtonIcon(opcion);
  selector.classList.remove("abierto");
  selectorBtn.setAttribute("aria-expanded", "false");

  currentMode = opcion.dataset.value;
}

/**
 * Cierra el selector si se hace clic fuera.
 */
function handleClickOutside(event) {
  if (!selector.contains(event.target)) {
    selector.classList.remove("abierto");
    selectorBtn.setAttribute("aria-expanded", "false");
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

  selectorBtn.setAttribute("aria-expanded", "false");
  selectorBtn.addEventListener("click", toggleSelector);

  opciones.forEach((opcion) => {
    opcion.tabIndex = 0;
    opcion.setAttribute("role", "button");
    opcion.setAttribute("aria-label", opcion.title);
    opcion.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectOption(opcion);
        selectorBtn.focus();
      }
    });
    opcion.addEventListener("click", () => {
      selectOption(opcion);
    });
  });

  document.addEventListener("click", handleClickOutside);
}
