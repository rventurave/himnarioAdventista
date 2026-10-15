import { initViewportLayout } from "./utils/viewportLayout.js";
import { initRouter } from "./core/router.js";
import { initSearch, resetHomeSearch } from "./components/search/searchController.js";
import { initSelector } from "./components/selector/selectorController.js";
import {
  closeHymn,
  initHymn,
  openHymn,
  showHome,
} from "./components/hymn/hymnController.js";
import { initKeyboard } from "./components/hymn/keyboardController.js";

initViewportLayout();
initSelector();
initSearch();
initHymn();
initKeyboard();

initRouter({
  onHome: () => {
    closeHymn();
    showHome();
    resetHomeSearch();
  },
  onHymn: (id, mode) => {
    openHymn(id, mode);
  },
});
