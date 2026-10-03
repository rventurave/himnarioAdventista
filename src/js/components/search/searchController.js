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

/**
 * Se ejecuta cuando el usuario selecciona un himno.
 * Navega a /X conservando el modo elegido en el selector.
 */
function selectHymn(hymn) {
  setInputValue(hymn.title);
  clearSuggestions();

  navigate(getHymnPath(hymn.number, getMode()));
}

/**
 * Busca y muestra las sugerencias.
 */
async function showSuggestions(query) {
  try {
    const results = await searchHymns(query);

    renderSuggestions(results);
  } catch (error) {
    console.error("Error al buscar himnos:", error);

    renderErrorMessage("Ocurrió un error al buscar.");
  }
}

/**
 * Escucha lo que el usuario escribe.
 */
function handleInput() {
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

    if (results.length === 1) {
      selectHymn(results[0]);
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
