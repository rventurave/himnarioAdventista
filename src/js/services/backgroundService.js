// El fondo predeterminado permanece definido en CSS, también sin JavaScript.
let loadToken = 0;

export function resetHymnBackground() {
  loadToken += 1;
  document.body.style.removeProperty("--hymn-background");
}

export function setHymnBackground(hymn) {
  resetHymnBackground();
  const token = loadToken;
  const route = hymn?.backgroundImage;

  if (typeof route !== "string" || !route.trim()) {
    return;
  }

  // Solo muestra la imagen cuando carga correctamente. Una navegación posterior
  // invalida esta petición para que un fondo antiguo no reemplace al nuevo.
  const image = new Image();
  image.onload = () => {
    if (token === loadToken) {
      document.body.style.setProperty("--hymn-background", `url(${JSON.stringify(image.src)})`);
    }
  };
  image.src = route;
}
