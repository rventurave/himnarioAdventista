# SEO del Himnario Adventista

## Diagnóstico

La revisión partió de Git limpio. El proyecto usa HTML, CSS y módulos JavaScript
nativos, no React. El router History API ya admitía `/1` a `/613` y los modos
`lyrics`, `sung` y `karaoke`. Sin embargo, el build reescribía todos esos números
a la portada: compartían título, descripción y canonical de `/`, no tenían
letra en el HTML inicial y el sitemap solo anunciaba la portada. El h1 y los
metadatos de inicio ya eran descriptivos y no estaban duplicados; se conservaron.
`robots.txt` ya permitía rastrear y anunciaba el sitemap correcto; no se modificó.

La documentación anterior registró el 9 de octubre un sitemap público con
respuesta 404 y una redirección 308 de `/1?mode=lyrics` hacia la portada. Es un
antecedente del despliegue, no una medición repetida en esta sesión. Las nuevas
reescrituras apuntan a HTML propios; se debe confirmar su comportamiento en
Cloudflare después de publicar.

## Implementación

El comando existente `python3 tools/build_pages.py` ahora genera HTML individual
con número, título, referencia bíblica y letra completa reales de cada entrada.
Valida los números únicos 1–613 y falla si falta una letra o está vacía. No genera
páginas de relleno. Los HTML se guardan bajo `dist/_hymns/` y las reescrituras
mantienen las URLs públicas `/1` a `/613`. Es importante probar `/404`: también
es un himno válido, distinto del archivo de error `dist/404.html`.

El prerenderizado estático evita depender de JavaScript para obtener el contenido
inicial. Sin JavaScript se muestra una lectura sencilla de la letra; al iniciar
la aplicación, la vista interactiva sustituye ese artículo. No se detecta al
robot ni se sirve contenido diferente según el visitante. Se mantienen el
buscador, los modos, audios remotos y sincronizaciones existentes.

La portada conserva el h1 original y un enlace discreto al índice `/himnos`
en el pie de página, visible con y sin JavaScript. Se retiró el párrafo
introductorio y su enlace bajo el buscador para recuperar el bloque central
original. El índice contiene 613 enlaces HTML por número y título; los estilos
del buscador y del reproductor se conservan. El índice
es una página nueva de lectura sencilla. El sitemap contiene 615 URLs canónicas,
sin variantes de modo ni fechas de modificación inventadas. El sitemap de la raíz
se conserva para mantenerlo coherente, pero el build siempre lo genera desde el
catálogo. No se añadieron meta keywords.

Cada himno tiene título, descripción, canonical y Open Graph propios en el HTML.
La navegación interna actualiza esas mismas etiquetas sin duplicarlas. Los modos
con parámetros comparten la canonical del número, pues muestran el mismo himno.
Se conservó el origen existente `https://himnario-adventista.pages.dev`; si cambia
el dominio principal, debe cambiarse en index.html, robots.txt, tools/seo_pages.py
y src/js/services/seoService.js, y regenerarse sitemap.xml.

## Verificación local

```sh
python3 tools/build_pages.py
python3 -B -m unittest discover -s tests
node --test tests/*.test.mjs
```

Las pruebas recorren los metadatos y letras de los 613 HTML, los enlaces del
índice, el sitemap, la exclusión de MP3 del build y las rutas HTTP locales
(incluidas variantes de modo). El servidor de vista previa documentado en
cloudflare-pages.md sirve los HTML generados de dist. El servidor normal desde
la raíz genera el índice y las páginas de himnos bajo demanda con el mismo
generador del build. Así `/himnos` funciona con `python3 server.py` incluso
sin un build previo; para comprobar el resultado publicado se usa dist.

`tests/browser-seo.mjs` verifica portada, ausencia de precargas de audio,
lectura sin JavaScript, el himno 404 y metadatos al navegar. Las pruebas de
reproducción existentes siguen en tests/browser-r2.mjs y tests/browser-lyrics.mjs.
No se ha publicado ni se han cambiado ajustes de Cloudflare.

## Comprobación después de publicar y Search Console

1. En Pages conserva el build `python3 tools/build_pages.py` y salida `dist`.
2. Abre `/`, `/himnos`, `/1`, `/404`, `/613` y `/25?mode=karaoke` en el dominio
   publicado. Comprueba respuesta 200, título, canonical y letra en Ver código
   fuente. Un recurso inexistente y una ruta desconocida deben devolver 404.
   La vista previa Python no emula todas las normalizaciones de URL de Pages.
3. En Search Console, selecciona la propiedad del dominio publicado y envía
   `sitemap.xml` en Sitemaps: debe contener 615 URLs.
4. En Inspección de URLs prueba `/`, `/1`, `/404` y `/613`. Ejecuta «Probar URL
   publicada» y revisa HTML, captura, acceso permitido y canonical declarada.
   Compara después la canonical elegida por Google cuando haya datos indexados.
5. Solicita indexación de la portada y unas pocas páginas representativas;
   Google descubrirá las demás mediante índice y sitemap.
6. Revisa «Indexación de páginas» para errores, duplicados o exclusiones, y
   «Rendimiento» para consultas como «himnario adventista», «himnos adventistas»
   y búsquedas por número/título. La indexación y posición dependen de Google;
   el sitemap y estas mejoras no garantizan posiciones ni plazos.

La estrategia sigue la documentación de Google sobre
[SEO con JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics?hl=es),
[enlaces rastreables](https://developers.google.com/search/docs/fundamentals/get-started-developers)
y [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Resultados de esta sesión

Build correcto; 10 pruebas Python y 11 pruebas Node correctas. Las pruebas de
Chromium verificaron SEO con y sin JavaScript y navegación interna; la prueba
R2 verificó búsqueda, controles, cambio de modo/himno y fallos simulados sin
errores JavaScript. Otra prueba comprobó los himnos 1 y 613 en Cantado y
Karaoke (saltos, secciones, lista y finalización) y el modo Letra en el himno 8.
No se comprobó la indexación pública ni la reproducción de
los 613 himnos completos.

## Corrección de navegación local al índice

El enlace apunta a `/himnos`. Se reprodujo que el servidor de desarrollo
devolvía la portada para esa ruta, mientras dist/himnos.html contenía los 613
enlaces correctos. server.py ahora usa el generador compartido para servir
el índice y los himnos desde la raíz, sin consultar un dist potencialmente
obsoleto. No se modificaron URLs, reescrituras de producción ni metadatos.
Cloudflare Pages puede servir himnos.html como `/himnos` sin JavaScript, según
su [resolución de rutas](https://developers.cloudflare.com/pages/configuration/serving-pages/).
Debe conservarse el build y publicar dist; la corrección no realiza un despliegue.

Comprobación pública de esta corrección: `/himnos` en el dominio canónico
respondió HTTP 404. El build local sí contiene el índice de 613 enlaces. Falta
publicar dist con el comando de build configurado y repetir la comprobación
pública; no se accedió a la configuración privada de Pages. Las pruebas
Chromium pasaron desde raíz y dist con JavaScript activado/desactivado,
incluyendo clic portada → índice → himno. También pasó la prueba de audio R2.

## Diagnóstico del sitemap y las redirecciones en Pages (13 de octubre de 2026)

La comprobación pública actual de `/sitemap.xml` respondió HTTP 200 con
`Content-Type: application/xml`, sin redirecciones y con **615 URLs**. El XML
público y `dist/sitemap.xml` son idénticos byte a byte (SHA-256
`fc068576cf5b5f94e3a35076204c5201183ccac18bd3c7300b1dc2fc4edd7331`).
La solicitud con User-Agent Googlebot dio el mismo resultado; esto no simula
la infraestructura ni la IP de Google. `robots.txt` permite el rastreo.
No se reprodujo el sitemap de una URL ni el error de descarga de Search Console.
Un sitemap de una sola URL también puede ser XML válido: la cantidad de URLs
no prueba la causa de «Couldn't fetch». Hay que revisar su fecha de última lectura
y la URL enviada en la propiedad correcta, y solicitar una nueva lectura.

El build generó 613 HTML de himnos y un índice con 613 enlaces. No se encontró
un proceso alternativo que sobrescriba el XML: build_pages.py lo genera desde
el catálogo. El sitemap de la raíz también contiene 615 URLs. La rama local main
y HEAD remoto coincidían en 9adb69b al iniciar este diagnóstico. Sin acceso al
panel privado no se puede confirmar el comando, salida o SHA del último
despliegue; la igualdad del XML confirma solo ese recurso.

Sí se reprodujeron fallos de rutas en producción: `/himnos` devolvía 308 hacia
sí misma, mientras `/1` y `/613` redirigían a `/_hymns/1` y `/_hymns/613`.
Eso rompe la navegación de la aplicación y la estabilidad de las URLs públicas.
La causa era usar destinos `.html` en las reescrituras, que Pages normaliza a
URLs sin extensión. Se retiró la regla del índice (Pages sirve himnos.html
directamente) y se cambiaron los destinos de himnos a rutas sin extensión.
El bucle afecta al índice, pero **no demuestra** la causa del error histórico
de descarga del XML en Search Console. No se modificaron cachés, WAF ni robots
sin evidencia de un bloqueo.

Se verificó la corrección con `wrangler pages dev dist`: las 615 URLs responden
HTTP 200 sin redirecciones y con contenido idéntico a dist. También se validan
los modos con query string y los recursos ausentes con 404. Esto complementa
las pruebas Python; estas por sí solas no detectaban la normalización de Pages.

### Publicar y verificar

1. En Workers & Pages, abre el proyecto `himnario-adventista`. Revisa Settings
   → Builds & deployments / Build configuration: framework None, raíz del
   repositorio, comando `python3 tools/build_pages.py`, salida `dist`. Revisa
   que Production branch sea la rama que realmente publicarás (main en este
   repositorio). Guarda si algún valor difiere.
2. Revisa los cambios y, cuando lo decidas, incorpóralos tú a esa rama remota.
   No basta con reintentar el despliegue antiguo: debe usar el commit que
   contiene las reescrituras corregidas. En Deployments verifica el SHA
   desplegado, estado Success y que sea Production.
3. En el log de build confirma `613 himnos; sin MP3`. El build regenera el
   sitemap desde el catálogo. No subas la raíz del repositorio como salida.
4. Alternativamente, para publicar el dist local sin commit/push, ejecuta tú:

   ```sh
   python3 tools/build_pages.py
   npx wrangler login
   npx wrangler pages deploy dist --project-name=himnario-adventista --branch=main
   ```

   Confirma primero que main sea la rama de producción configurada. El comando
   de deploy publica; no se ejecutó durante la tarea.
5. Después de publicar el mismo build que tienes localmente, ejecuta:

   ```sh
   PAGES_TEST_BASE_URL=https://himnario-adventista.pages.dev node tests/pages-routes.mjs
   ```

   Debe confirmar 615 rutas HTTP 200 sin redirecciones y contenido idéntico a
   dist, incluidos sitemap/robots. Abre también `/himnos`, selecciona un himno
   y comprueba la vista interactiva.
6. En Search Console usa la propiedad `https://himnario-adventista.pages.dev/`,
   vuelve a enviar `sitemap.xml` y revisa Última lectura. Usa Inspección de URL
   → Probar URL publicada para `/himnos`, `/1` y `/613`. Si persiste «Couldn't
   fetch», revisa el detalle y fecha de ese intento: las pruebas actuales no
   pueden certificar el acceso desde los servidores reales de Google.

Referencias: [configuración del build](https://developers.cloudflare.com/pages/configuration/build-configuration/),
[normalización de rutas](https://developers.cloudflare.com/pages/configuration/serving-pages/)
y [errores de sitemaps en Search Console](https://support.google.com/webmasters/answer/7451001?hl=es).

Resultados finales: build correcto; 11 pruebas Python y 11 Node correctas;
prueba de las 615 rutas contra el motor local de Pages correcta; pruebas
Chromium de SEO/navegación con y sin JavaScript y de reproducción R2 correctas.
No se cambiaron diseño, letras, reproductor, metadatos ni contenido del sitemap.
No se hicieron commits, push ni despliegues.
