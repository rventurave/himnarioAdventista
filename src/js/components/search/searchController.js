import { searchHymns } from "../../api/hymnsApi.js";
import { getHymnPath, navigate } from "../../core/router.js";
import { getMode } from "../selector/selectorController.js";
import {
  getInputValue,
  setInputValue,
  showSelectedHymn,
  hideSelectedHymn,
  renderSuggestions,
  renderErrorMessage,
  clearSuggestions,
  onHymnSelected,
  onClearSelected,
  onEditSelected,
  getForm,
  getInput,
  getActiveSuggestion,
  moveActiveSuggestion,
} from "./searchView.js";

let searchTimeout = null;
let selectedHymn = null;
let searchToken = 0;

/**
 * Se ejecuta cuando el usuario selecciona un himno.
 * Completa el buscador; el formulario inicia la reproducción después.
 */
function selectHymn(hymn) {
  clearTimeout(searchTimeout);
  searchToken += 1;
  selectedHymn = hymn;
  setInputValue(`${hymn.number} | ${hymn.title}`);
  showSelectedHymn(hymn);
  clearSuggestions();
}

//Vuelve al campo de texto y olvida la selección.
function clearSelection() {
  clearTimeout(searchTimeout);
  searchToken += 1;
  selectedHymn = null;
  hideSelectedHymn();
  setInputValue("");
  clearSuggestions();
  getInput().focus();
}

// La vista ya es visible cuando el router prepara una búsqueda nueva.
export function resetHomeSearch() {
  clearTimeout(searchTimeout);
  searchToken += 1;
  selectedHymn = null;
  hideSelectedHymn();
  setInputValue("");
  clearSuggestions();
  // No abre el teclado virtual al cargar o regresar en dispositivos táctiles.
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    getInput().focus({ preventScroll: true });
  }
}

export function typeInHomeSearch(event) {
  if (document.querySelector("#view-home").hidden || event.key.length !== 1 ||
      event.target.closest?.("button, a, [role='button'], [role='combobox'], [role='listbox']")) return;

  // Recupera el foco si se perdió al pulsar una zona vacía de la página.
  const input = getInput();
  if (selectedHymn) clearSelection();
  input.focus({ preventScroll: true });
  input.setRangeText(event.key, input.selectionStart, input.selectionEnd, "end");
  event.preventDefault();
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function openSelectedHymn() {
  clearSuggestions();
  navigate(getHymnPath(selectedHymn.number, getMode()));
}

/**
 * Busca y muestra las sugerencias.
 */
async function showSuggestions(query) {
  const token = ++searchToken;
  try {
    const results = await searchHymns(query);
    if (token !== searchToken || query !== getInputValue()) return;

    renderSuggestions(results);
  } catch (error) {
    if (token !== searchToken) return;
    console.error("Error al buscar himnos:", error);

    renderErrorMessage("Ocurrió un error al buscar.");
  }
}

/**
 * Escucha lo que el usuario escribe.
 */
function handleInput() {
  searchToken += 1;
  selectedHymn = null;
  hideSelectedHymn();
  const query = getInputValue();

  clearTimeout(searchTimeout);
  clearSuggestions();

  if (!query) {
    clearSuggestions();
    return;
  }

  /*
   * Esperamos un pequeño momento antes de buscar.
   * Esto evita hacer demasiadas búsquedas mientras
   * el usuario está escribiendo rápidamente.
   */
  searchTimeout = setTimeout(() => {
    showSuggestions(query);
  }, 150);
}

/**
 * Controla el envío del formulario.
 */
async function handleSubmit(event) {
  event.preventDefault();
  if (document.querySelector("#view-home").hidden) return;
  clearTimeout(searchTimeout);
  const token = ++searchToken;

  // Enter o el botón inician el himno seleccionado en el modo elegido ahora.
  if (selectedHymn) {
    openSelectedHymn();
    return;
  }

  const activeHymn = getActiveSuggestion();
  if (activeHymn) {
    selectHymn(activeHymn);
    openSelectedHymn();
    return;
  }

  const query = getInputValue();

  if (!query) {
    return;
  }

  try {
    /*
     * Si es un número, buscamos directamente.
     * Si es texto, buscamos por título.
     */
    const results = await searchHymns(query);
    if (token !== searchToken || query !== getInputValue()) return;

    if (results.length > 0) {
      selectHymn(results[0]);
      openSelectedHymn();
      return;
    }

    renderSuggestions(results);
  } catch (error) {
    console.error("Error al realizar la búsqueda:", error);
  }
}

function handleSearchKeydown(event) {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "Enter" && event.repeat) {
    event.preventDefault();
  } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && getActiveSuggestion()) {
    event.preventDefault();
    moveActiveSuggestion(event.key === "ArrowDown" ? 1 : -1);
  }
}

/**
 * Cierra las sugerencias cuando se hace clic
 * fuera del buscador.
 */
function handleClickOutside(event) {
  if (!event.target.closest(".search-container")) {
    clearSuggestions();
  }
}

/**
 * Inicializa el componente de búsqueda.
 */
export function initSearch() {
  const input = getInput();
  const form = getForm();

  onHymnSelected(selectHymn);
  onClearSelected(clearSelection);
  onEditSelected(clearSelection);

  input.addEventListener("input", handleInput);
  input.addEventListener("keydown", handleSearchKeydown);
  form.addEventListener("submit", handleSubmit);
  document.addEventListener("click", handleClickOutside);
}
