import { HYMN_REQUIRED_FIELDS } from "../core/constants.js";

//Verifica que un objeto tenga la estructura del hymn
export function validateHymn(hymn) {
  if (!hymn || typeof hymn !== "object") {
    return false;
  }

  return HYMN_REQUIRED_FIELDS.every((field) => field in hymn);
}

//Verifica que el catálogo arreglo

export function validateCatalog(data) {
  if (!Array.isArray(data)) {
    throw new Error("La respuesta del API no es un arreglo");
  }

  const invalid = data.find((hymn) => !validateHymn(hymn));

  if (invalid) {
    throw new Error(`Himno con formato inválido: ${JSON.stringify(invalid)}`);
  }

  return data;
}
