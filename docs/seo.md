# SEO del Himnario Adventista

La portada incluye título descriptivo, descripción, metadatos Open Graph,
idioma español y viewport. Su encabezado conserva la clase y apariencia
existentes. Dos párrafos visibles explican el catálogo de 613 himnos y los
modos de consulta; están en el HTML y se leen sin JavaScript.

No se añaden listas de palabras clave, textos ocultos ni precargas de audios
o sincronizaciones. Los audios de R2 y las letras y tiempos originales no
se modificaron. `robots.txt` permite el rastreo, incluidos los recursos que
Google necesita para renderizar la aplicación, y el build lo copia a `dist`.

## Dominio pendiente

El repositorio no contiene el dominio público definitivo. No se ha inventado
una URL canónica ni un sitemap con un origen ficticio. Falta confirmar ese
dominio para agregar canonical, `og:url`, el sitemap y su referencia en robots.

Las rutas `/1` a `/613` ya están definidas en las reescrituras de Pages y en
el router. No son páginas prerenderizadas: todas reciben el mismo HTML y
obtienen el contenido por JavaScript. El sitemap debe usar las rutas reales
del catálogo, sin variantes duplicadas de modo ni fechas de modificación
inventadas. También hay que evitar servir un canonical de portada a todos
los himnos: el build actual comparte un único HTML entre esas rutas.

## Propuesta de páginas por himno

Generar HTML individual con título, número y letra del catálogo permitiría
que Google y los servicios sociales lean el contenido sin ejecutar JavaScript.
El impacto sería añadir 613 documentos al build, sustituir las reescrituras
actuales por páginas estáticas y dar a cada una un canonical propio. Se pueden
conservar `/numero`, los parámetros de modo y los módulos del reproductor.
No hace falta subir audios ni modificar letras o sincronizaciones.

Esta ampliación no está implementada; requiere acordar su alcance antes de
cambiar la publicación. Google recomienda contenido prerenderizado y títulos
descriptivos únicos: [SEO de aplicaciones JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

## Comprobaciones

```bash
python3 tools/build_pages.py
python3 -m unittest discover -s tests
node --test tests/*.test.mjs
```

`tests/browser-seo.mjs` comprueba la portada con Chrome, también sin JavaScript,
y verifica que no se soliciten MP3, LRC ni archivos de sincronización al inicio.
Utiliza la misma configuración Playwright descrita en `cloudflare-pages.md`.

## Google Search Console después de completar el dominio y publicar

1. Abre [Google Search Console](https://search.google.com/search-console/) y
   añade una propiedad **Prefijo de URL** con la URL HTTPS pública exacta.
   Si usas un dominio propio y controlas su DNS, puedes elegir **Dominio**.
2. Verifica la propiedad. En un subdominio `pages.dev`, usa la etiqueta HTML
   proporcionada por Google en el `<head>` de `index.html`, ejecuta el build y
   publica. Conserva esa etiqueta. Para una propiedad Dominio, usa el registro
   TXT de DNS que Google indique; no puedes administrar el DNS de `pages.dev`.
3. Comprueba que el sitemap y robots publicados respondan 200 y contengan el
   dominio canónico confirmado. En **Sitemaps**, envía `sitemap.xml`.
4. Usa **Inspección de URL → Probar URL publicada** para revisar el contenido
   renderizado y la URL canónica. Solicita indexación de la portada.
5. Revisa después los informes de indexación y rendimiento. Estas mejoras
   facilitan el rastreo; no garantizan indexación ni una posición concreta.

Referencias: [verificación de propiedad](https://support.google.com/webmasters/answer/9008080)
y [construcción y envío de sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
