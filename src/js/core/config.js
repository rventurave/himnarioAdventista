const API_CONFIG = {
  baseUrl: "/data/himnario-api.json",
  audioBaseUrl: "/data",
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
