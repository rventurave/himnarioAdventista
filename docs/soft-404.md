# Diagnóstico del Soft 404 en /1

Se revisó producción antes de modificar código. Las respuestas se obtuvieron con
curl y Chromium, con y sin JavaScript; esto no reproduce los servidores reales
de Google ni permite garantizar su decisión de indexación.

## Evidencia inicial

| URL pública | HTTP y destino | HTML recibido |
|---|---|---|
| /1 | 200, conserva /1 | Idéntico a dist/_hymns/1.html |
| /2 | 200, conserva /2 | Idéntico a dist/_hymns/2.html |
| /613 | 200, conserva /613 | Idéntico a dist/_hymns/613.html |
| /himnos | 200, conserva /himnos | Idéntico a dist/himnos.html; 613 enlaces |
| /9999 | 404, conserva /9999 | Página de error real |

El build conserva las reescrituras a destinos sin extensión, por ejemplo
`/1 /_hymns/1 200`. No se reprodujeron el bucle del índice ni la redirección a
rutas internas corregidos anteriormente. Por ello no se modificaron las reglas.

Sin JavaScript, los tres himnos muestran título y letra reales. Para /1, el
`title` es `Himno 1: Cantad alegres al Senor | Himnario Adventista`, y la canonical
es `https://himnario-adventista.pages.dev/1`. La letra empieza con «Cantad alegres
al Señor,» y termina con «él los ampara con su amor.», incluyendo las tres
estrofas del TXT original. /2 muestra «Da gloria al Senor» y /613, «Hoy nos toca
trabajar», con sus respectivas letras y metadatos.

Con JavaScript se comprobó una diferencia sustancial: app.js eliminaba
`#static-hymn` al arrancar, antes de resolver el catálogo. En DOMContentLoaded,
la lectura de `document.body.innerText` devolvió cero caracteres visibles en
los tres himnos. Cuatro segundos después, /1 mostraba solamente «#1» y
«Cantad alegres al Senor» (26 caracteres). /2 y /613 mostraban también solo
número y título. La lista `#lyrics-list` tenía cero elementos y la letra
completa prerenderizada ya no existía en el DOM.

La presentación inicial depende de la entrada de la voz, no de la existencia de
la letra. El reproductor solo construía su lista completa después de pulsar L
cuando ya había pasado esa presentación. Así, el contenido principal desaparecía
del DOM renderizado aunque estuviera disponible en el HTML recibido. No se
observaron errores JavaScript o fallos de red en esa medición normal.

## Causa probable y límite del diagnóstico

La pérdida de contenido al hidratar la aplicación es un error reproducible y
la explicación más probable del Soft 404 reportado. Google documenta que una
página vacía, casi vacía o con recursos críticos ausentes durante el renderizado
puede clasificarse como Soft 404, aunque responda HTTP 200.

No se dispone del HTML/captura que Google obtuvo en el intento concreto de
Search Console; por tanto, no se atribuye con certeza su clasificación a una
causa única. Se corrige la pérdida demostrada; no se altera el status, canonical,
metadatos ni se agregan palabras clave.

## Corrección mínima

- app.js deja de eliminar incondicionalmente el artículo prerenderizado.
- hymnController.js mantiene esa lectura mientras carga el catálogo. Si falla,
  conserva la letra en lugar de dejar una pantalla vacía y un error no capturado.
- Cuando el himno se resuelve, copia la letra a la lista existente y muestra la
  presentación con su título antes de retirar el artículo de respaldo.
- audioMode.js construye la lista completa cuando obtiene la sincronización,
  antes de reproducir o de pulsar L, también al navegar entre himnos.

La lista mantiene su comportamiento visual habitual: está plegada durante la
presentación y se consulta mediante L en la vista de reproducción. No se añade
un bloque exclusivamente para robots ni una nueva sección visual. El contenido
ya existe en el DOM; la tecla L cambia su presentación y permite navegar por las
líneas. La presentación inicial sigue mostrando número y título, no toda la
letra a la vez. Esta corrección conserva el diseño y no pretende garantizar por
sí sola la eliminación de la clasificación Soft 404.

## Pruebas y publicación

```sh
python3 tools/build_pages.py
python3 -B -m unittest discover -s tests
node --test tests/*.test.mjs
npx wrangler pages dev dist --ip 127.0.0.1 --port 3300
# En otra terminal, con Playwright y Chromium configurados:
TEST_BASE_URL=http://127.0.0.1:3300 node tests/browser-prerender.mjs
TEST_BASE_URL=http://127.0.0.1:3300 node tests/browser-seo.mjs
TEST_BASE_URL=http://127.0.0.1:3300 node tests/browser-r2.mjs
PAGES_TEST_BASE_URL=http://127.0.0.1:3300 node tests/pages-routes.mjs
```

Pasaron 11 pruebas Python, 11 Node y las pruebas Chromium indicadas. La nueva
prueba bloquea temporalmente el catálogo y verifica que /1, /2 y /613 mantienen
la letra visible durante la carga. Después verifica primera y última líneas en
el DOM y la lista visible al pulsar L. También simula un fallo del catálogo y
comprueba que se conserva la lectura del himno 1 sin errores JavaScript. Las
615 URLs respondieron 200 sin redirecciones en el motor local de Pages; /999 y
un recurso ausente devolvieron 404. No se ha verificado la reproducción completa
de los 613 himnos ni se ha certificado la indexación por Google.

Para llevar la corrección a producción, publica el nuevo build de dist con el
comando habitual `python3 tools/build_pages.py`, conservando dist como salida.
Los cambios funcionales son tres módulos JavaScript; los HTML y sus metadatos
no cambian. Las pruebas y esta documentación deben acompañarlos en el repositorio
si se publica desde Git. No se hicieron commits, push ni despliegue.

Tras publicar, usa Inspección de URL → Probar URL publicada para /1, /2 y /613.
Revisa el HTML renderizado: debe contener la primera y última línea en la lista
sin que Google necesite reproducir audio ni pulsar L. La captura puede conservar
la presentación de número y título: eso es deliberado para mantener el diseño.
Comprueba también las letras con JavaScript desactivado y la lista L como usuario.
Si el Soft 404 persiste, revisa la captura, el HTML y los recursos del intento
real de Google antes de hacer otros cambios. Después solicita indexación o
validación según el informe disponible.

Fuentes: [Soft 404 según Google](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors)
y [contenido en pestañas o acordeones](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing).
