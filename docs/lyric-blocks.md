# Presentación por estrofas, coros y partes

## Diagnóstico

Los TXT contienen marcadores numéricos y Coro/Estribillo y conservan los versos
como renglones. parseHymn ya separaba estrofas y coro; su secuencia intercala el
coro tras cada estrofa. Hay 322 himnos con coro. No se cambió ese orden ni el
parser. La división de frases para los tiempos ocurre en expandHymn/splitPhrase;
la presentación anterior mostraba y animaba cada frase y mostraba la siguiente.

Los tres modos compartían los tiempos TXT + sync.json, después LRC completo y,
si era necesario, el respaldo acústico aproximado existente. Solo letra emplea
el mismo reloj sin audio y, si no encuentra tiempos utilizables, navegación
manual. Cantado y Karaoke seleccionan respectivamente MP3 cantado e instrumental
R2. Los errores de audio conservan la vista de letra completa. Esos mecanismos,
las URL y los archivos de datos no se reescribieron.

## Algoritmo y presentación

lyricBlocks.js es una capa visual independiente de los relojes. Crea una fila
por verso original y por aparición de la sección; nunca parte un renglón ni
mezcla estrofas. Para asociar filas a los cues existentes compara todo el texto
normalizado y usa sus intervalos de caracteres, sin crear timestamps. La
normalización sirve solo para comparar: se muestran las cadenas originales.

blockPresentation.js mide con DOM real la fuente y tamaño actuales, la anchura
disponible, el alto del viewport, encabezado, aviso, controles, márgenes y espacio
interno. La medición se cachea durante cada distribución y considera los saltos
de línea y la envoltura automática. El elemento de medición es temporalmente
invisible y aria-hidden por motivos de layout; se vacía tras medir, no contiene
texto añadido para buscadores. Las letras completas permanecen en su lista real.

Prioridades:

1. Si la sección completa cabe, se muestra entera, incluso con más de 20 palabras.
2. Si no cabe, se prueban todos los cortes entre versos que permitan dos partes
   legibles. Cuatro versos prefieren 2 + 2 cuando ambas mitades caben.
3. Se equilibran palabras y versos, penalizando muestras de un solo renglón y
   considerando las pausas de punto, punto y coma, dos puntos y coma. 15–20
   palabras es una referencia suave al elegir cortes, no una cuota ni un límite.
4. Si no hay dos partes que quepan, una partición dinámica minimiza la cantidad
   de partes legibles y luego equilibra su contenido. Si ni un verso individual
   cabe, se conserva íntegro reduciendo la fuente de ese bloque para que quepa
   completo, sin desplazamiento ni recorte.

Se reproduce el ejemplo solicitado con los cuatro versos juntos si caben y el
corte exacto 2 + 2 cuando no caben. Los bloques se centran horizontal y
verticalmente. Solo el bloque actual ocupa la capa de presentación; ya no se
mezcla con un adelanto de otra estrofa. Se mantiene la paleta existente y se usa
el dorado que ya empleaba la lista para identificar el verso activo. La fuente
sigue siendo Nunito; encabezados y etiquetas usan Bebas Neue.

La transición horizontal suma 400 ms: 200 de salida y 200 de entrada. Al avanzar
sale a la izquierda y entra desde la derecha; al retroceder se invierte. No hay
dos bloques visibles superpuestos. Durante una ráfaga de controles se conserva
el último destino pendiente, sin una cola creciente ni callbacks obsoletos. La
limpieza al cambiar de himno cancela las animaciones. prefers-reduced-motion
produce cambio inmediato, también si se activa durante la transición.

La redistribución responde a resize, orientación, visualViewport, pantalla
completa y carga de fuentes. Conserva el verso activo o la primera fila de la
muestra manual; nunca reinicia el audio o el reloj. El contenedor conserva una
altura estable durante la navegación, con margen interno para los glifos de
Nunito y sin barras de desplazamiento; las excepciones de espacio reducen su
fuente para caber completas.

## Integración de los modos y límites de tiempos

En Letra las flechas saltan al bloque siguiente/anterior. Con tiempos se utiliza
el inicio del primer cue existente de ese bloque; sin tiempos se navega
manualmente por sus filas. Se mantiene pausa/reanudación y avance automático
cuando ya había sincronización. No se solicita MP3 en Letra.

En Cantado/Karaoke continúa funcionando el mismo audio, con sus controles de
pausa y seek de cinco segundos. Los cambios de cue dentro del mismo bloque
solo actualizan el verso resaltado; no disparan otra transición. En pausas
entre cues se conserva el bloque. La lista L sigue disponible y permite saltar
a los tiempos existentes. Si falla el audio se conserva la lectura completa.
El adelanto visual previo de un segundo se conserva; no se cambió ningún
start/end, LRC, JSON o MP3. Las transiciones no recalculan velocidades ni duraciones.

La precisión no puede superar la de los datos de origen. Un cue LRC que abarque
varios versos no aporta el instante de cada uno; se resalta según el cue y el
bloque de su inicio, sin inventar separaciones temporales. En los 610 sync.json
aceptados del catálogo cada inicio de bloque tiene un cue inequívoco; se validó
automáticamente. Las estimaciones acústicas siguen señaladas como aproximadas.

Se encontraron tres limitaciones **preexistentes** que el motor ya descarta:

| Himno | Problema en el JSON existente |
|---|---|
| 17 | Un fragmento con start=end=106.03 |
| 60 | Dos fragmentos con start=end=201.51 |
| 185 | Tres fragmentos con start=end=157.62 |

No se corrigieron esos archivos ni se atribuyeron tiempos exactos nuevos. En
Letra se verificó el respaldo manual por bloques de los tres, sin MP3. En audio
se conserva la prioridad LRC/respaldo acústico y el aviso aproximado anterior;
si no puede obtenerse una referencia utilizable, permanece la letra completa.

## Excepciones de espacio comprobadas

Se recorrieron todos los bloques de los 613 himnos en Chromium con Nunito y los
controles de Letra visibles. Las cantidades siguientes cuentan apariciones de
secciones, incluidos coros repetidos, no himnos distintos:

| Viewport | Bloques totales | Secciones con más de 2 partes | Bloques con fuente reducida |
|---|---:|---:|---:|
| 1920×1080 | 3015 | 1 | 0 |
| 1280×800 | 3791 | 27 | 0 |
| 390×844 | 3054 | 0 | 0 |
| 320×568 | 6763 | 761 | 2 |
| 844×390 | 7958 | 1270 | 1 |

Con una pantalla ancha y alta casi todas las secciones caben en una o dos partes;
solo unas pocas requieren tres o más. La altura reducida (horizontal 844×390 o
móviles estrechos 320×568) obliga a más partes y, en contados bloques, a reducir
la fuente para conservar la letra completa. No se promete que 15–20 palabras
quepan siempre: mandan los versos y la geometría.

El detalle por himno, aparición y parte está en [lyric-block-layout.json](lyric-block-layout.json).
Sus columnas están declaradas en el propio JSON. Los resultados dependen del
viewport y de las métricas de la fuente; no son reglas fijas por número de himno.

## Verificaciones

- 613 TXT: comparación de todas las filas originales, sin pérdidas ni duplicados;
  secuencia completa de estrofas/coros y grupos en seis capacidades simuladas.
- Ejemplo exacto, 2/3/4/6/9/15 versos, menos de 15 palabras, 15–20 y más de 20,
  cortes equilibrados, puntuación irregular, un verso indivisible y coros repetidos.
- Correspondencia textual y starts de bloque con las 610 sincronizaciones válidas,
  sin modificar los tiempos. Para las tres inválidas se usaron cues sintéticos
  exclusivamente en pruebas de asociación de texto, nunca en producción.
- Geometría real de todos los bloques de los 613 himnos en los cinco viewports:
  sin contenido cortado ni barras de desplazamiento; los bloques excepcionales
  reducen su fuente para caber completos.
- Transiciones de ida/vuelta, cambios rápidos, resize/orientación y reduced motion;
  cambio de preferencia de movimiento durante una transición.
- Letra con reloj virtual, pausa, flechas por bloques, fin, carga obsoleta y
  respaldo manual. Cantado y Karaoke: seek, resaltado, lista L, fin y recarga.
  Prueba real de reproducción/sincronización de 1 y 8 en ambos modos.
- Fallos 404, red, audio temprano/tardío, karaoke y pérdida simultánea de audio/TXT:
  se conserva la letra completa. Pruebas de fuentes en escritorio/móvil y sin JS.
- Pruebas SEO: 613 HTML, metadatos individuales, rutas y 615 URLs del sitemap.
- Resultado final: 19 pruebas Node y 11 Python aprobadas; 36 cargas/recargas
  de /1, /2 y /613 con modos explícitos, omitidos, vacíos e inválidos, sin errores
  JavaScript ni reproducción automática durante esa comprobación.

Comandos (con Playwright/Chromium configurados y servidor de dist en puerto 3400):

```sh
python3 tools/build_pages.py
node --test tests/*.test.mjs
python3 -B -m unittest discover -s tests
TEST_BASE_URL=http://127.0.0.1:3400 BLOCK_REPORT=/tmp/hymn-block-report.json node tests/browser-blocks.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-lyrics-auto.mjs
TEST_BASE_URL=http://127.0.0.1:3400 TEST_HYMNS=1,8 node tests/browser-lyrics.mjs
TEST_BASE_URL=http://127.0.0.1:3400 TEST_HYMNS=1,8,613 node tests/browser-audio-fallback.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-fonts.mjs
TEST_BASE_URL=http://127.0.0.1:3400 TEST_LEGACY_ROUTES=0 node tests/browser-routing.mjs
```

Las pruebas de navegador emulan tamaños móviles en Chromium; queda comprobar
la experiencia física en iOS/Safari/Android y proyectores, especialmente los
casos de desplazamiento. No se escucharon completos los 613 audios ni se
certifica una sincronización vocal exacta en los himnos con datos aproximados.

## Archivos de esta intervención

Presentación: src/js/utils/lyricBlocks.js, src/js/components/hymn/blockPresentation.js,
hymnView.js, lyricsMode.js, audioMode.js y src/css/index.css.
Pruebas: tests/lyric-blocks.test.mjs, browser-blocks.mjs, browser-lyrics-auto.mjs,
browser-lyrics.mjs y browser-r2.mjs. Documentación: este archivo y el informe JSON.

Se endureció tools/seo_pages.py para reconocer etiquetas meta/link con saltos de
línea: el formateo actual de index.html impedía generar las descripciones únicas
y extraer enlaces tipográficos completos. Se restauró el resultado SEO esperado,
sin cambiar títulos, descripciones previstas, canonical o sitemap.

Los cambios tipográficos que ya estaban pendientes al comenzar se conservaron.
No se alteraron buscador, fondos, archivos TXT/MP3/LRC/JSON, URLs R2 o rutas.
No se hicieron commits, push ni despliegues. Debe publicarse el nuevo dist para
que esta presentación llegue al dominio de producción.
