// El viewport visual incluye barras móviles y teclado sin forzar pantalla completa.
export function initViewportLayout() {
  const root = document.documentElement;
  const form = document.querySelector('#search-form');
  const selector = document.querySelector('.selector');
  const footer = document.querySelector('.home-footer');
  let frame;
  function layout() {
    const viewport = window.visualViewport;
    const height = viewport && viewport.scale === 1 ? viewport.height : innerHeight;
    const value = `${Math.round(height)}px`;
    if (root.style.getPropertyValue('--app-height') !== value) root.style.setProperty('--app-height', value);
    if (!form || document.querySelector('#view-home').hidden) return;
    const bottom = Math.min(height - 12, footer.getBoundingClientRect().top - 8);
    const rect = form.getBoundingClientRect();
    const below = Math.max(44, bottom - rect.bottom - 8);
    form.parentElement.style.setProperty('--suggestions-height', `${Math.floor(below)}px`);
    const control = selector.getBoundingClientRect();
    const above = Math.max(44, control.top - 12);
    const menuBelow = Math.max(44, bottom - control.bottom - 6);
    const openAbove = menuBelow < 175 && above > menuBelow;
    selector.classList.toggle('menu-above', openAbove);
    selector.style.setProperty('--menu-height', `${Math.floor(openAbove ? above : menuBelow)}px`);
  }
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout); };
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  document.addEventListener('fullscreenchange', schedule);
  new ResizeObserver(schedule).observe(form);
  layout();
}
