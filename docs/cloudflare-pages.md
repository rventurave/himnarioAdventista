# Cloudflare Pages y R2

## Arquitectura y diagnóstico

La aplicación es estática: HTML, CSS y módulos JavaScript nativos, sin React,
Vite, paquete npm ni compilación. El buscador descarga y valida
`/data/himnario-api.json`, busca por número exacto o título y navega con History
API a `/<numero>?mode=lyrics|sung|karaoke`.

El catálogo contiene 613 entradas con `id`, `number`, `title`, `mp3Route`,
`mp3RouteInstr`, `mp3Filename`, `bibleReference` y `txtRoute`. No contiene
`mp3Url` ni `mp3UrlInstr`; las rutas MP3 son referencias como
`/audios/cantadas/001 - Cantad alegres al Senor.mp3`, con nombres reales.
El código admite los campos alternativos URL si en el futuro existen, pero
prioriza las rutas actuales. No construye nombres a partir del título o número,
ni deduce que exista un instrumental usando el nombre de la grabación cantada.

Antes se anteponía `/data` tanto a MP3 como a TXT/LRC/JSON. Ahora `dataBaseUrl`
conserva `/data` y `audioBaseUrl` apunta exclusivamente a R2. Ambas constantes
están en `src/js/core/config.js`; `configure()` permite ajustes programáticos.
No hay variables de entorno frontend en esta arquitectura. Para cambiar a un
dominio propio, edita únicamente `audioBaseUrl`, conservando el sufijo
`/data/audios/`, y vuelve a publicar. No se necesitan credenciales R2.

`resolveAudioUrl()` conserva el nombre exacto, acepta referencias de archivo,
`/audios/…`, `/data/audios/…` o URL completa y las dirige a la base R2 configurada.
Decodifica y codifica cada segmento una vez, sin codificar los separadores.
Rechaza referencias vacías, otras carpetas, rutas anidadas y extensiones ajenas
a MP3. No realiza comprobaciones de red antes de reproducir.

El resultado del himno 001 cantado es:

```text
https://pub-1ca54579e235492c815179e37558122a.r2.dev/data/audios/cantadas/001%20-%20Cantad%20alegres%20al%20Senor.mp3
```

## Reproducción y sincronización

Letra conserva las diapositivas y navegación existentes. Cantado selecciona
`mp3Route`; Karaoke selecciona `mp3RouteInstr`. Solo el himno seleccionado
carga audio. Se conservan espacio para play/pausa, flechas para buscar cinco
segundos, `L` para alternar lista/frase y los demás controles actuales.

Los tiempos se obtienen primero de `.sync.json`, después de LRC completo y,
si faltan ambos, del análisis acústico existente del audio seleccionado como
referencia (preferentemente cantado). Ese último caso hace `fetch` del MP3 en
memoria y requiere CORS. Se conserva su aviso de sincronización aproximada;
no se generan ni se reemplazan archivos de sincronización. Cantado y Karaoke
siguen usando el mismo reloj y adelanto visual de un segundo existentes.

El cambio de himno cancela el análisis y descarta cargas anteriores mediante
tokens, limpia la línea activa y detiene/libera la fuente anterior. Los errores
del elemento audio o del intento de reproducción muestran un aviso; un bloqueo
de autoplay conserva el botón Comenzar. Si el audio falla durante la preparación,
se muestra la letra completa. Si falla después, se conserva la letra cargada.

`server.py` se conserva para desarrollo: archivos estáticos, fallback de rutas
de himnos y soporte HTTP Range. No es un backend de datos y no se ejecuta en
Cloudflare Pages.

## Publicación desde GitHub

En Cloudflare, crea/conecta un proyecto **Pages** al repositorio GitHub:

| Ajuste | Valor |
|---|---|
| Framework | None |
| Directorio raíz | raíz del repositorio |
| Comando de build | `python3 tools/build_pages.py` |
| Directorio de salida | `dist` |
| Rama de producción | la rama que uses para publicar |

El paso de build solo copia los archivos públicos; está justificado para excluir
los MP3 locales, `.venv`, herramientas y otros archivos del repositorio. No
compila JavaScript ni introduce dependencias. Copia `index.html`, `src`, el
catálogo, todas las letras y todas las sincronizaciones. No lee `data/audios`.
No elimina archivos locales. `dist/` es salida generada e ignorada por Git.

Genera 613 reglas `_redirects` de reescritura HTTP 200 para los números reales,
y un `404.html` para que datos ausentes respondan 404 en lugar de HTML de la SPA.
Los recursos de `index.html` usan `/src/`, válidos al abrir una ruta interna.
Pages sirve directamente los TXT, LRC y JSON. No requiere Functions ni bindings
R2. Referencia: [reescrituras de Pages](https://developers.cloudflare.com/pages/configuration/redirects/)
y [comportamiento de rutas y 404](https://developers.cloudflare.com/pages/configuration/serving-pages/).

Antes de tu commit autorizado, incluye los nuevos archivos de código/pruebas,
esta guía y las sincronizaciones que quieras publicar. Hay sincronizaciones
anteriores aún no rastreadas por Git: un build local las incluye, pero GitHub
solo publicará las que estén en tu commit. No se han hecho commits ni push.
Git no rastrea MP3/WAV/OGG; `.gitignore` excluye ahora la ruta real `data/audios/`.

Con Pages conectado a GitHub, cada nuevo commit de la rama elegida ejecuta el
build y publica los archivos pequeños. Los MP3 de R2 no se vuelven a subir.
No se ha creado ni desplegado un proyecto Cloudflare desde este entorno.

## CORS del bucket

La reproducción con `<audio>` sin `crossorigin` funciona directamente para
estos MP3 públicos. El respaldo acústico usa `fetch`/AudioContext y sí necesita
CORS. En la comprobación del 9 de octubre de 2026, el recurso 001 respondió 200,
`audio/mpeg` y `Accept-Ranges: bytes`, sin `Access-Control-Allow-Origin` para
`http://localhost:3000`. Chrome reprodujo los himnos probados con tiempos
guardados; falta autorizar los orígenes para el respaldo acústico.

En **R2 → himnario-audios → Settings → CORS policy**, coloca esta política,
**sustituyendo `https://TU-PROYECTO.pages.dev` por el origen real**, sin barra
final ni rutas:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3100",
      "https://TU-PROYECTO.pages.dev"
    ],
    "AllowedMethods": ["GET", "HEAD"]
  }
]
```

Solo lectura, sin cookies, credenciales ni orígenes universales. No hacen falta
cabeceras personalizadas para el `fetch` actual. Añade explícitamente tu dominio
Pages personalizado o el origen de una preview si necesitas ese respaldo allí.
No se configuró el bucket automáticamente.

Comprueba las cabeceras después de guardar (sustituye el origen):

```bash
curl -I -H 'Origin: https://TU-PROYECTO.pages.dev' \
  'https://pub-1ca54579e235492c815179e37558122a.r2.dev/data/audios/cantadas/001%20-%20Cantad%20alegres%20al%20Senor.mp3'
```

Fuente: [CORS en R2](https://developers.cloudflare.com/r2/buckets/cors/).
`r2.dev` tiene límites variables y está pensado para pruebas; para producción
configura un dominio personalizado y cambia la constante centralizada.
[Límites de R2](https://developers.cloudflare.com/r2/platform/limits/).

## Comandos de comprobación

```bash
# Pruebas unitarias y de archivos publicados; Node moderno y Python 3
node --test tests/*.test.mjs
python3 -m unittest discover -s tests
python3 tools/build_pages.py

# Desarrollo con R2
python3 server.py

# Vista local del resultado publicado, en otra terminal
python3 -c 'import server; server.ROOT = server.os.path.join(server.ROOT, "dist"); server.PORT = 3100; server.main()'
```

Pruebas opcionales de navegador, sin añadir dependencias al proyecto:

```bash
npm exec --yes --package=playwright -- playwright install chromium
npm exec --yes --package=playwright -- sh -c 'PLAYWRIGHT_MODULE="$(dirname "$(command -v playwright)")/../playwright/index.mjs" TEST_BASE_URL=http://localhost:3100 TEST_HYMNS=1,186 node tests/browser-lyrics.mjs'
npm exec --yes --package=playwright -- sh -c 'PLAYWRIGHT_MODULE="$(dirname "$(command -v playwright)")/../playwright/index.mjs" TEST_BASE_URL=http://localhost:3100 node tests/browser-r2.mjs'
```

También se puede definir `BROWSER_EXECUTABLE` con la ruta de Chrome instalado.
Las pruebas de navegador reproducen audio remoto; no requieren MP3 locales.

Resultados ejecutados: 11 pruebas Node y cinco Python correctas; Chrome sobre
`dist` comprobó 001 y 186 en Cantado/Karaoke, pausa, seek, límites de estrofas,
resaltado, finalización y modo Letra. Otra prueba comprobó búsqueda, controles
de teclado, cambio de himno/modo sin recarga y un 404 y fallo de red simulados con aviso y letra
completa. No hubo errores JavaScript. Los archivos publicados de letras,
catálogo y sincronización se compararon byte a byte con los originales.

No se verificó la existencia remota de los 1226 MP3 ni la reproducción de los
613 himnos. La comprobación unitaria sí recorrió todas sus referencias reales.
Un cliente HEAD de Python recibió 403 mientras curl y Chrome funcionaron; no
se considera ese cliente una validación de disponibilidad general del bucket.
Queda verificar el respaldo acústico después de CORS, autoplay en dispositivos
móviles y las rutas recargadas en el dominio final de Pages.

El comando de publicación automática es el build configurado arriba, activado
por tus commits a GitHub. Si deseas subir **solo `dist`** manualmente a un
proyecto Pages ya creado, la alternativa es:

```bash
npx wrangler pages deploy dist --project-name=NOMBRE-REAL-DEL-PROYECTO
```

Ese último comando publica y requiere tu autenticación: no se ejecutó. Nunca
publiques la raíz completa del repositorio ni `data/audios` en Pages.
