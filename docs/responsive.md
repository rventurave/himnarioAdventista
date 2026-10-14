# Adaptación responsive del Himnario Adventista

Se mantiene una aplicación HTML/CSS/JavaScript nativo, con las fuentes, colores,
fondos, rutas, letras y sincronizaciones existentes. No se hizo commit, push ni
publicación. Los cambios anteriores del espacio de trabajo se conservaron.

## Diagnóstico y cambios

En 320×568, la lista de sugerencias llegaba hasta el píxel 745. En otras
resoluciones también quedaba fuera de pantalla. Ahora su altura se calcula a
partir del formulario y el viewport visible, y se desplaza dentro de su propio
contenedor. El menú de modos puede abrirse hacia arriba si dispone de más espacio.
La lógica de búsqueda, selección y sugerencias permanece intacta.

Quitar selección medía 24×24 px; volver medía 38–40 px de alto y las flechas
móviles 40 px. Los controles principales ahora ofrecen al menos 44×44 px. En
pantallas estrechas, una selección larga ocupa una fila completa y los controles
quedan debajo. Los títulos seleccionados y sugeridos pueden envolver sin puntos
suspensivos. El campo conserva 16 px para evitar el zoom automático de entrada.

El reproductor suponía márgenes de 40 px y un ancho máximo de 1100 px en sus
mediciones. Ahora mide el contenedor, sus paddings, el espacio de los botones y
el ancho real de las letras. Se mantiene el algoritmo de división por versos,
las pausas, la sincronización y las animaciones horizontales. El área de letras
puede reducirse durante un cambio de presentación sin expulsar los controles.

Las letras móviles tenían un mínimo de 32 px. La escala fluida usa aproximadamente
20–24 px en teléfonos y aprovecha un área de hasta 1600 px en pantallas grandes.
Las portadas permiten varias líneas y se ajustan al espacio que dejan los
controles. Al volver a una portada se cancela el bloque transitorio; la lista
completa de letras no se borra. Los indicadores momentáneos de pausa/reproducción
se ocultan en las portadas para evitar superposición con el título.

La altura se adapta al viewport visual y a `dvh`, con áreas seguras. Pantalla
completa sigue siendo voluntaria. Sin Fullscreen API, el mismo control ofrece
una vista ampliada dentro del navegador; Escape sale de ella sin navegar.
Las barras del navegador permanecen bajo control del sistema operativo.

Se añaden controles táctiles de pausa/reproducción y avance/retroceso. Reutilizan
las acciones y el salto existente de cinco segundos; no cambian las URL ni los
archivos de audio. El selector conserva su lógica y permite activar sus opciones
con Enter o Espacio. El índice prerenderizado usa una rejilla fluida y enlaces
con altura táctil, sin modificar sus 613 enlaces ni el HTML.

## Archivos modificados en esta adaptación

- `src/css/index.css`: tamaños fluidos, menús, objetivos táctiles y layout del reproductor.
- `src/css/typography.css`: distribución responsive del índice, sin cambiar fuentes.
- `src/js/app.js`: inicialización del ajuste de viewport.
- `src/js/utils/viewportLayout.js`: altura visual y espacio disponible para los menús.
- `src/js/components/hymn/blockPresentation.js`: medición del área real y observación de tamaños.
- `src/js/components/hymn/hymnView.js`: controles táctiles y ajuste de portadas.
- `src/js/components/hymn/hymnController.js`: conexiones de controles y vista ampliada.
- `src/js/components/hymn/keyboardController.js`: Escape en la vista ampliada.
- `src/js/components/hymn/lyricsMode.js`: estado del botón de reproducción; navegación centralizada.
- `src/js/components/hymn/audioMode.js`: estado de controles táctiles según eventos del audio.
- `src/js/components/selector/selectorController.js`: activación por teclado y estado accesible.
- `tests/browser-responsive.mjs`: matriz funcional, capturas y controles táctiles con R2 real.
- `tests/browser-blocks.mjs`: amplía las pruebas de los 613 himnos a once resoluciones.
- `tests/browser-covers.mjs`: amplía las pruebas de portadas y admite varias líneas.
- `tests/browser-visual.mjs`: verifica la alternativa a Fullscreen API.
- `docs/responsive.md`: este informe.

Los assets correspondientes se actualizaron en `dist/src`. No se modificaron
`index.html`, los generadores SEO, el catálogo, las letras ni las sincronizaciones.

## Resoluciones verificadas

| Resolución | Uso de referencia |
| --- | --- |
| 320×568 | Móvil pequeño |
| 375×667 | Móvil pequeño |
| 390×844 | Móvil estándar |
| 430×932 | Móvil estándar |
| 768×1024 | Tablet vertical |
| 1024×768 | Tablet horizontal |
| 1366×768 | Laptop |
| 1920×1080 | Escritorio |
| 2560×1440 | Pantalla grande |
| 844×390 | Teléfono horizontal |
| 390×320 | Área visible reducida, equivalente a teclado/barras |

Las pruebas existentes también incluyen 1280×800 y 320×640. Las áreas seguras
se verifican mediante paddings simulados de 44 px laterales y 34 px inferiores.

## Pruebas y conservación del contenido

- 11 pruebas Python y 19 pruebas Node correctas.
- Portadas y referencias de los 613 himnos verificadas en once resoluciones.
- Bloques de los 613 himnos sin texto recortado ni barras internas en once resoluciones.
- Portada, sugerencias, selección, menú, objetivos táctiles, índice, recarga,
  teclado, pantalla completa y orientación verificados con Chromium/Playwright.
- Inicio, desarrollo y cierre comprobados en letra automática/manual, cantado y karaoke.
- Reproducción y sincronización reales desde R2 en cantado y karaoke; controles
  táctiles comprobados con los himnos 1 y 186 y avance/retroceso de cinco segundos.
- Prueba de letras sincronizadas con audios reales: 1, 8, 83, 379, 524 y 585,
  en cantado y karaoke. Prueba R2 existente de buscador y controles correcta.
- Autoplay bloqueado, 404 y fallo de red conservan la letra completa; los 613
  himnos mantienen lectura sin JavaScript.
- SEO, prerender y 48 cargas/recargas de rutas correctos.
- Cloudflare Pages local: 615 URL con HTTP 200 y respuestas 404 correctas.
- Comparación SHA-256: los 613 HTML prerenderizados, la portada HTML, el índice
  HTML y el sitemap permanecen idénticos byte por byte.
- `git diff --check` sin errores.

Capturas y resultados consolidados se guardan en `/tmp/hymn-responsive-final`.
Las comprobaciones focalizadas de fin nativo de audio están también en
`/tmp/hymn-responsive-verified`. El cierre real se valida con `audio.ended`: la
duración de un MP3 puede ajustarse mientras el navegador recibe nuevos frames.
El reporte de geometría también se genera mediante `BLOCK_REPORT`.

## Rendimiento y límites de las verificaciones

Antes de cambiar el código, la medición en reposo registró cero layouts y cero
recálculos de estilo en 1,5 segundos. La medición final mantiene ambos valores
en cero; el tiempo de JavaScript observado fue aproximadamente 1 ms en ese
intervalo. No se justificó reescribir el motor ni introducir optimizaciones de
recursos. No se añadieron bibliotecas, nuevas imágenes ni solicitudes de MP3 en
la portada o en Solo letra.

La preparación local de 30 himnos de prueba tomó 15,4 ms antes; las mediciones
posteriores variaron entre 10,8 y 33 ms bajo cargas concurrentes de pruebas.
Una repetición de nueve muestras dio una mediana de 11,9 ms para las 30
preparaciones. Son mediciones orientativas, no una comparación controlada de velocidad en
hardware móvil. El layout continúa agrupando observaciones de tamaño por frame.

Las pruebas móviles son emuladas en Chromium. No sustituyen una verificación en
Safari/iOS o Android físicos, especialmente de barras, teclado y notch reales.
La reproducción depende de la red y de las restricciones de autoplay del navegador.
Algunos himnos no tienen referencia bíblica registrada; se conserva ese dato.

## Reproducir las pruebas

Con Playwright/Chromium configurados y un servidor local de `dist`:

```sh
python3 -B -m unittest discover -s tests
node --test tests/*.test.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-responsive.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-blocks.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-covers.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-visual.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-fonts.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-lyrics-auto.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-lyrics.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-r2.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-audio-fallback.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-routing.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-prerender.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-seo.mjs
# Contra wrangler pages dev dist, para comprobar reglas de Pages:
PAGES_TEST_BASE_URL=http://127.0.0.1:3401 node tests/pages-routes.mjs
```

Se pueden definir `PLAYWRIGHT_MODULE` y `BROWSER_EXECUTABLE` si las dependencias
están fuera del proyecto. `RESPONSIVE_OUTPUT` cambia el destino de las capturas;
`RESPONSIVE_VIEWPORTS=320x568,844x390` permite una ejecución focalizada.
