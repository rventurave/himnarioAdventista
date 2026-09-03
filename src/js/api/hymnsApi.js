const API_CONFIG = {
  baseUrl: "/data/himnario-api.json",
  timeout: 10000,
};

const HYMN_REQUIRED_FIELDS = [
  "id",
  "number",
  "title",
  "mp3Route",
  "mp3RouteInstr",
  "mp3Filename",
  "bibleReference",
  "txtRoute",
];

/**
 * Verifica que un objeto tenga la estructura mínima
 * necesaria para representar un himno.
 */
function validateHymn(hymn) {
  if (!hymn || typeof hymn !== "object") {
    return false;
  }

  return HYMN_REQUIRED_FIELDS.every((field) => field in hymn);
}

/**
 * Verifica que el catálogo sea un arreglo
 * y que todos sus elementos sean himnos válidos.
 */
function validateCatalog(data) {
  if (!Array.isArray(data)) {
    throw new Error("La respuesta del API no es un arreglo");
  }

  const invalid = data.find((hymn) => !validateHymn(hymn));

  if (invalid) {
    throw new Error(`Himno con formato inválido: ${JSON.stringify(invalid)}`);
  }

  return data;
}

/**
 * Realiza un fetch con un tiempo máximo de espera.
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_CONFIG.timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Obtiene todo el catálogo de himnos.
 */
export async function fetchHymnCatalog() {
  const response = await fetchWithTimeout(API_CONFIG.baseUrl);

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("La respuesta no es JSON válido");
  }

  return validateCatalog(data);
}

/**
 * Busca himnos por número o título.
 *
 * Ejemplos:
 * searchHymns("25")
 * searchHymns("cantad")
 * searchHymns("señor")
 */
export async function searchHymns(query) {
  const hymns = await fetchHymnCatalog();

  const search = query.trim().toLowerCase();

  if (!search) {
    return [];
  }

  return hymns.filter((hymn) => {
    const number = String(hymn.number);
    const title = String(hymn.title).toLowerCase();

    return number === search || title.includes(search);
  });
}

/**
 * Obtiene un himno por su ID.
 */
export async function getHymnById(id) {
  const hymns = await fetchHymnCatalog();

  return hymns.find((hymn) => String(hymn.id) === String(id)) || null;
}

/**
 * Obtiene un himno por su número.
 */
export async function getHymnByNumber(number) {
  const hymns = await fetchHymnCatalog();

  return hymns.find((hymn) => String(hymn.number) === String(number)) || null;
}

/**
 * Permite modificar la configuración del API.
 */
export function configure(config) {
  Object.assign(API_CONFIG, config);
}

/**
 * Devuelve una copia de la configuración.
 */
export function getConfig() {
  return { ...API_CONFIG };
}
