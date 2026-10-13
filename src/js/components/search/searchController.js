import { searchHymns } from "../../api/hymnsApi.js";
import { getHymnPath, navigate } from "../../core/router.js";
import { getMode } from "../selector/selectorController.js";
import {
  getInputValue,
  setInputValue,
  renderSuggestions,
  renderErrorMessage,
  clearSuggestions,
  onHymnSelected,
  getForm,
  getInput,
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
  setInputValue(`${hymn.number} - ${hymn.title}`);
  clearSuggestions();

  getInput().focus();
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
  const query = getInputValue();

  clearTimeout(searchTimeout);

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
  clearTimeout(searchTimeout);
  const token = ++searchToken;

  const query = getInputValue();

  if (!query) {
    return;
  }

  // Enter o el botón inician el himno seleccionado en el modo elegido ahora.
  if (selectedHymn && query === `${selectedHymn.number} - ${selectedHymn.title}`) {
    openSelectedHymn();
    return;
  }

  try {
    /*
     * Si es un número, buscamos directamente.
     * Si es texto, buscamos por título.
     */
    const results = await searchHymns(query);
    if (token !== searchToken || query !== getInputValue()) return;

    if (results.length === 1) {
      selectHymn(results[0]);
      openSelectedHymn();
      return;
    }

    renderSuggestions(results);
  } catch (error) {
    console.error("Error al realizar la búsqueda:", error);
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

  input.addEventListener("input", handleInput);
  form.addEventListener("submit", handleSubmit);
  document.addEventListener("click", handleClickOutside);
}
