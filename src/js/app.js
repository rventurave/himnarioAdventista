import { searchHymns } from "./api/hymnsApi.js";

const form = document.querySelector("#search-form");
const input = document.querySelector("#search-input");
const suggestions = document.querySelector("#search-suggestions");

let searchTimeout = null;

/**
 * Escucha lo que el usuario escribe.
 */
input.addEventListener("input", () => {
  const query = input.value.trim();

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
});

/**
 * Busca y muestra las sugerencias.
 */
async function showSuggestions(query) {
  try {
    const results = await searchHymns(query);

    renderSuggestions(results);
  } catch (error) {
    console.error("Error al buscar himnos:", error);

    suggestions.innerHTML = `
      <div class="suggestion-message">
        Ocurrió un error al buscar.
      </div>
    `;
  }
}

/**
 * Muestra los resultados encontrados.
 */
function renderSuggestions(results) {
  suggestions.innerHTML = "";

  if (results.length === 0) {
    suggestions.innerHTML = `
      <div class="suggestion-message">
        No se encontraron himnos.
      </div>
    `;

    suggestions.classList.add("visible");
    return;
  }

  /*
   * Mostramos como máximo 8 sugerencias.
   */
  results.slice(0, 8).forEach((hymn) => {
    const item = document.createElement("button");

    item.type = "button";
    item.className = "suggestion-item";

    item.innerHTML = `
      <span class="suggestion-number">
        ${hymn.number}
      </span>

      <span class="suggestion-title">
        ${hymn.title}
      </span>
    `;

    item.addEventListener("click", () => {
      selectHymn(hymn);
    });

    suggestions.appendChild(item);
  });

  suggestions.classList.add("visible");
}

/**
 * Se ejecuta cuando el usuario selecciona un himno.
 */
function selectHymn(hymn) {
  input.value = hymn.title;

  clearSuggestions();

  /*
   * Por ahora mostramos el himno seleccionado
   * en la consola.
   *
   * Más adelante podemos cambiar esto para
   * navegar a la página del himno.
   */
  console.log("Himno seleccionado:", hymn);
}

/**
 * Oculta las sugerencias.
 */
function clearSuggestions() {
  suggestions.innerHTML = "";
  suggestions.classList.remove("visible");
}

/**
 * Controla el envío del formulario.
 */
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = input.value.trim();

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
});

/**
 * Cierra las sugerencias cuando se hace clic
 * fuera del buscador.
 */
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-container")) {
    clearSuggestions();
  }
});
