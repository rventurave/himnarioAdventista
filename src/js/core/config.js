const API_CONFIG = {
  baseUrl: "/data/himnario-api.json",
  dataBaseUrl: "/data",
  // URL pública, sin credenciales. Puede sustituirse por un dominio propio.
  audioBaseUrl: "https://pub-1ca54579e235492c815179e37558122a.r2.dev/data/audios/",
  timeout: 10000,
};

//Permite modificar la configuración del API.

export function configure(config) {
  Object.assign(API_CONFIG, config);
}

//Devuelve una copia de la configuración.

export function getConfig() {
  return { ...API_CONFIG };
}

export default API_CONFIG;
