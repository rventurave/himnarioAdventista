import { initRouter } from "./core/router.js";
import { initSearch } from "./components/search/searchController.js";
import { initSelector } from "./components/selector/selectorController.js";
import {
  closeHymn,
  initHymn,
  openHymn,
  showHome,
} from "./components/hymn/hymnController.js";
import { initKeyboard } from "./components/hymn/keyboardController.js";

// El HTML inicial contiene la letra; la vista interactiva toma el relevo.
document.getElementById("static-hymn")?.remove();

initSelector();
initSearch();
initHymn();
initKeyboard();

initRouter({
  onHome: () => {
    closeHymn();
    showHome();
  },
  onHymn: (id, mode) => {
    openHymn(id, mode);
  },
});
