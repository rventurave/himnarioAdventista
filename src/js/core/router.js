import { DEFAULT_MODE, HOME_PATH, MODES } from "./constants.js";

const VALID_MODES = Object.values(MODES);

let handlers = {
  onHome: null,
  onHymn: null,
};

/**
 * Interpreta la URL actual y devuelve la ruta correspondiente.
 *
 * "/"          -> { name: "home" }
 * "/25"        -> { name: "hymn", id: "25", mode: "sung" }
 * "/25?mode=x" -> { name: "hymn", id: "25", mode: "sung" }  (modo inválido)
 */
export function parseRoute(location = window.location) {
  const path = location.pathname.replace(/\/+$/, "") || HOME_PATH;

  if (path === HOME_PATH || path === "/index.html") {
    return { name: "home" };
  }

  const match = /^\/(\d+)$/.exec(path);

  if (match) {
    const requested = new URLSearchParams(location.search).get("mode");

    return {
      name: "hymn",
      id: match[1],
      mode: VALID_MODES.includes(requested) ? requested : DEFAULT_MODE,
    };
  }

  return { name: "unknown" };
}

/**
 * Construye la URL de un himno: /25?mode=sung
 */
export function getHymnPath(id, mode = DEFAULT_MODE) {
  const normalized = VALID_MODES.includes(mode) ? mode : DEFAULT_MODE;

  return `/${encodeURIComponent(id)}?mode=${normalized}`;
}

function dispatch() {
  const route = parseRoute();

  if (route.name === "hymn") {
    if (handlers.onHymn) {
      handlers.onHymn(route.id, route.mode);
    }
    return;
  }

  if (handlers.onHome) {
    handlers.onHome();
  }
}

/**
 * Navega a una ruta interna sin recargar la página.
 */
export function navigate(path, { replace = false } = {}) {
  if (replace) {
    window.history.replaceState({}, "", path);
  } else {
    window.history.pushState({}, "", path);
  }

  window.scrollTo(0, 0);
  dispatch();
}

/**
 * Inicializa el router y ejecuta el handler de la ruta actual.
 */
export function initRouter({ onHome, onHymn } = {}) {
  handlers = { onHome, onHymn };

  window.addEventListener("popstate", dispatch);

  dispatch();
}
