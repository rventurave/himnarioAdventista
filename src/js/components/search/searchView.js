const form = document.querySelector("#search-form");
const input = document.querySelector("#search-input");
const suggestions = document.querySelector("#search-suggestions");
const selected = document.querySelector("#search-selected");
const selectedNumber = document.querySelector("#search-selected-number");
const selectedTitle = document.querySelector("#search-selected-title");
const selectedClear = document.querySelector("#search-selected-clear");

//obtener el valor actualidad
export function getInputValue() {
  return input.value.trim();
}

export function setInputValue(value) {
  input.value = value;
}

//El himno elegido se muestra aparte: número morado + título, sin separador.
export function showSelectedHymn(hymn) {
  selectedNumber.textContent = hymn.number;
  selectedTitle.textContent = hymn.title;
  input.hidden = true;
  selected.hidden = false;
}

export function hideSelectedHymn() {
  input.hidden = false;
  selected.hidden = true;
}

//Mostramos sugerencias de busqueda, 8 como maximo
export function renderSuggestions(results) {
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
      if (onSelectHymn) {
        onSelectHymn(hymn);
      }
    });

    suggestions.appendChild(item);
  });

  suggestions.classList.add("visible");
}

//Error
export function renderErrorMessage(message) {
  suggestions.innerHTML = `
    <div class="suggestion-message">
      ${message}
    </div>
  `;
  suggestions.classList.add("visible");
}

//Eliminar sugerencias
export function clearSuggestions() {
  suggestions.innerHTML = "";
  suggestions.classList.remove("visible");
}

let onSelectHymn = null;
export function onHymnSelected(callback) {
  onSelectHymn = callback;
}

let onClearSelection = null;
export function onClearSelected(callback) {
  onClearSelection = callback;
}

let onEditSelection = null;
export function onEditSelected(callback) {
  onEditSelection = callback;
}

selectedClear.addEventListener("click", (event) => {
  event.stopPropagation();
  onClearSelection?.();
});

//Pulsar el número o el título vuelve a permitir escribir una búsqueda nueva.
selected.addEventListener("click", (event) => {
  if (!event.target.closest("#search-selected-clear")) {
    onEditSelection?.();
  }
});

export function getForm() {
  return form;
}

export function getInput() {
  return input;
}

export function getSuggestionsContainer() {
  return suggestions;
}
