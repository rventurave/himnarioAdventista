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

## Seguimiento: error de audio en la captura de Google

Se confirmó que la corrección anterior estaba publicada: app.js,
hymnController.js y audioMode.js públicos eran idénticos a los locales; también
coincidían /1, CSS y sitemap. No era un despliegue pendiente de esa corrección.

Se reprodujo la captura sin reproducir audio, sustituyendo play() por un rechazo:

| Momento del fallo | Resultado anterior |
|---|---|
| Autoplay denegado (NotAllowedError) | Comenzar; lista completa en DOM, plegada |
| Fallo antes de la sincronización | Aviso y letra completa visible |
| Fallo después de la sincronización | Título, referencia, aviso y una frase; lista vacía |

La causa confirmada era doble. enterContent() conservaba la vista sincronizada
incluso con audioFailed: ocultaba la lista y mostraba la frase actual. A su vez,
showList(false) borraba todos sus elementos. Si el fallo ocurría cuando ya se
había entrado en contenido, el retorno anticipado impedía cambiar a la lectura
completa. Las pruebas anteriores no cubrían esos dos momentos y por eso no
bastaron para detectar el error.

Se cambió únicamente audioMode.js y hymnView.js: ocultar no borra la letra y
cualquier fallo tardío pasa a la vista completa existente, conservando título,
referencia y aviso. Si además falla el TXT, el respaldo reutiliza la letra del
HTML inicial. No se añadieron textos o controles, ni se cambió la presentación
normal, los fondos, canonical, metadatos o sitemap.

El MP3 de 001 respondió 200, audio/mpeg y Accept-Ranges: bytes, tanto a la
petición normal como con User-Agent Googlebot. Esto no reproduce la IP, política
multimedia ni recursos cargados por el renderizador de Google. No se puede
atribuir su error a un archivo inexistente, CORS, WAF o bloqueo del bucket sin
el detalle de recursos del intento real. El bloqueo normal de autoplay se
maneja aparte con Comenzar; no es el mensaje reportado. Los recursos multimedia
pueden no estar disponibles al renderizar, por lo que el texto debe ser legible
independientemente de su carga.

La prueba tests/browser-audio-fallback.mjs impide toda reproducción real de
HTMLMediaElement y comprueba que no se produzca ningún evento playing. Cubre
fallos antes y después de la sincronización, después de entrar en contenido,
404, fallo de red y pérdida simultánea de audio/TXT/sincronización. También
recorre los 613 himnos con MP3 fallido y comprueba cada línea textual, título,
referencia y canonical. Verifica lectura sin JavaScript para 1, 2 y 613.

```sh
TEST_BASE_URL=http://127.0.0.1:3300 node tests/browser-audio-fallback.mjs
# Prueba breve opcional, manteniendo los casos de error:
TEST_HYMNS=1,2,613 TEST_BASE_URL=http://127.0.0.1:3300 node tests/browser-audio-fallback.mjs
```

Debe publicarse el nuevo dist para aplicar los dos módulos corregidos. Tras
publicar, revisar el HTML y captura de la prueba de URL de Google: aun si aparece
el aviso de audio, las estrofas completas deben estar en la vista de lectura.
Esto corrige un fallo demostrado; la retirada de Soft 404 depende de la nueva
evaluación de Google. No se hicieron commits, push ni despliegues.

Resultados de este seguimiento: build, 11 pruebas Python y 11 Node correctos;
615 rutas verificadas contra el motor local de Pages. La prueba de fallo MP3
pasó en los 613 himnos, comprobando cada línea de los TXT, título, referencia
y canonical. También pasaron bloqueo de autoplay, fallos tempranos/tardíos,
fallo durante contenido, karaoke, alternancia L y fallo simultáneo de los
recursos de texto. No se produjo reproducción de audio. La lectura sin
JavaScript se comprobó en 1, 2 y 613; las pruebas Python recorrieron los 613 HTML.
El /robots.txt del origen R2 devolvió 404, sin un archivo de exclusión que
permita atribuir el error a una regla Disallow de ese origen.
