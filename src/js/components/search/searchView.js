const form = document.querySelector("#search-form");
const input = document.querySelector("#search-input");
const suggestions = document.querySelector("#search-suggestions");

//obtener el valor actualidad
export function getInputValue() {
  return input.value.trim();
}

export function setInputValue(value) {
  input.value = value;
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

export function getForm() {
  return form;
}

export function getInput() {
  return input;
}

export function getSuggestionsContainer() {
  return suggestions;
}
