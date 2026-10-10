# SEO del Himnario Adventista

El dominio canónico es `https://himnario-adventista.pages.dev/`.

La portada usa el título **Himnario Adventista del Séptimo Día | 613 Himnos**
y la descripción solicitada. Open Graph comparte ese título y descripción y
apunta al mismo dominio mediante `og:url`. Se conservan `lang="es"`, viewport
y el H1 visible **Himnario Adventista**. No se añaden párrafos descriptivos,
contenido oculto ni precargas de los audios o sincronizaciones.

## Diagnóstico del sitemap

En la comprobación del 9 de octubre de 2026 (America/Lima):

- La portada respondió HTTP 200, sin meta `noindex` ni cabecera `X-Robots-Tag`
  que impidiera indexarla.
- `robots.txt` respondió HTTP 200 y permitió rastrear `/`.
- `sitemap.xml` respondió HTTP 404 con una página HTML de error, sin
  redirección. Repitiendo la solicitud con User-Agent Googlebot también
  respondió 404. Esto no reproduce la infraestructura de Googlebot, pero sí
  confirma el mismo resultado para ambas solicitudes.
- El sitemap tampoco existía en el repositorio y el build no lo copiaba.

La causa comprobada del error de descarga es la ausencia del archivo publicado.
No se encontró un bloqueo de robots ni un XML existente que pudiera validarse.
No se tiene acceso al informe privado de Search Console ni al historial de sus
solicitudes, así que esta comprobación identifica el problema actual.

Se añadió un XML UTF-8 con el namespace estándar y la URL canónica de la portada.
El build copia `sitemap.xml` y `robots.txt` a la raíz de `dist`. Robots conserva
el rastreo permitido y anuncia la URL pública del sitemap. No se inventan fechas
`lastmod`, páginas ni variantes duplicadas de parámetros.

## Alcance de las URL individuales

El router y el build definen rutas de himnos, pero la comprobación pública de
`/1?mode=lyrics` devolvió HTTP 308 hacia `/?mode=lyrics`. No se considera una
página independiente confirmada para este sitemap. Por ahora solo se incluye
la portada, que respondió 200 directamente.

No se modificaron las reescrituras, el reproductor ni las rutas en esta tarea.
Resolver la navegación directa de himnos y darles HTML y canonical propios
requiere un cambio separado antes de incluirlos en el sitemap. No se generaron
613 páginas ni se alteraron las letras, audios o sincronizaciones.

## Pruebas y compilación

```bash
python3 tools/build_pages.py
python3 -m unittest discover -s tests
node --test tests/*.test.mjs
```

Las pruebas comprueban título y descripción exactos, canonical, Open Graph,
ausencia de párrafos y `noindex`, XML válido, robots, copias byte a byte y HTTP
local 200 sin redirecciones para HTML, robots y sitemap. La prueba de archivos
publicados conserva las letras, sincronizaciones y ambas verificaciones Google.

`tests/browser-seo.mjs` comprueba la portada con Chrome, con y sin JavaScript,
sus metadatos, acceso a los archivos SEO y que no se carguen MP3/LRC/sincronización
al iniciar. Usa la configuración Playwright de `cloudflare-pages.md`.

## Verificar después de tu despliegue

No se hicieron commits, push ni despliegues. La corrección local solo llegará
al dominio público cuando publiques los archivos nuevos y modificados.

1. Abre `https://himnario-adventista.pages.dev/sitemap.xml` y confirma que contiene
   XML, no una página de error. Comprueba `robots.txt` y su línea `Sitemap`.
2. Puedes comprobar códigos y cabeceras con:

   ```bash
   curl -i https://himnario-adventista.pages.dev/sitemap.xml
   curl -i https://himnario-adventista.pages.dev/robots.txt
   curl -I https://himnario-adventista.pages.dev/
   ```

   Espera HTTP 200 para los tres, y XML en el sitemap. El HTML debe conservar el
   canonical correcto y no debe aparecer una cabecera `X-Robots-Tag: noindex`.
3. En Google Search Console, selecciona la propiedad del prefijo
   `https://himnario-adventista.pages.dev/`. En **Sitemaps**, envía `sitemap.xml`
   o vuelve a enviar la URL corregida si ya estaba registrada.
4. Revisa **Última lectura** y el estado de procesamiento cuando Google vuelva
   a consultar el sitemap. El informe puede tardar en actualizarse.
5. Usa **Inspección de URL → Probar URL publicada** sobre la portada y solicita
   indexación. Revisa después la URL canónica elegida por Google y los informes
   de indexación y rendimiento.

Estas mejoras facilitan el rastreo, pero no garantizan una posición para una
búsqueda concreta. Referencias: [sitemaps de Google](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
y [informe de sitemaps de Search Console](https://support.google.com/webmasters/answer/7451001).
