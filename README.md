# Himnario Adventista

Aplicación web para proyectar himnos del Himnario Adventista con audio cantado, instrumental y letra.

## Requisitos

- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Python 3 (para el servidor local)

## Ejecución

```bash
cd himnarioAdventista
python3 server.py
```

Abrir `http://localhost:3000`

> ⚠️ `python3 -m http.server` **no** sirve rutas como `/25` (daría 404), porque no
> reescribe rutas desconocidas a `index.html`. Usa `server.py`, que sí lo hace.

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Buscador de himnos |
| `/25` | Abre el himno 25 con el modo por defecto (`sung`) |
| `/25?mode=lyrics` | Himno 25 en modo **Solo letra** |
| `/25?mode=sung` | Himno 25 en modo **Cantado** (audio cantado + letra sincronizada) |
| `/25?mode=karaoke` | Himno 25 en modo **Karaoke** (audio instrumental + letra sincronizada) |

El flujo es: elegir el modo en el selector, buscar el himno y seleccionarlo.
La aplicación navega a `/X?mode=...` y allí carga automáticamente los datos.

## Modos

- **Solo letra:** sin audio. Empieza en una pantalla de presentación (número + título)
  que permanece hasta que pulses `→`; después navega fragmento a fragmento con `←` / `→`.
- **Cantado:** audio cantado (`mp3Route`) con tiempos LRC o estimación acústica.
- **Karaoke:** audio instrumental (`mp3RouteInstr`) con **el mismo motor y tiempos**.

### Presentación inicial

Al entrar a `/X` se muestra primero una pantalla grande y centrada con el número y el
título del himno. En **Cantado** y **Karaoke** se mantiene mientras se preparan los tiempos. El audio arranca
automáticamente al terminar la preparación y la primera frase marca el inicio de la letra. Si el navegador bloquea el
autoplay aparece un botón **▶ Comenzar**. En **Solo letra** la presentación es la
"diapositiva 0" y no avanza sola: espera a que pulses `→`.

### Reproductor oculto

No hay controles nativos de audio visibles (ni barra de progreso, ni play/pausa, ni
volumen, ni tiempo). El `<audio>` existe internamente sin el atributo `controls`.
`Espacio` reproduce o pausa y muestra un indicador momentáneo ▶ / ⏸.

En Cantado y Karaoke la vista muestra la frase actual (y la siguiente, tenue).
Con `L` se alterna a la letra completa: la línea activa se resalta, hay
auto-scroll y se puede hacer clic en cualquier línea para saltar a ese punto.

## Controles de Teclado

| Tecla | Acción |
|-------|--------|
| `Esc` | Salir y volver a `/` (en pantalla completa, primero la cierra) |
| `←` / `→` | Solo letra: fragmento anterior / siguiente |
| `←` / `→` | Cantado y Karaoke: retroceder / adelantar 5 segundos |
| `Espacio` | Cantado y Karaoke: reproducir / pausar |
| `L` | Cantado y Karaoke: alternar frase actual / letra completa |
| `F` | Pantalla completa |

## Funcionalidades

- **Búsqueda** por número o título (con debounce)
- **613 himnos** del Himnario Adventista
- **Navegación por URL** (`/X?mode=...`) con router propio (History API)
- **Audio cantado** e **instrumental** con la misma letra sincronizada
- **Letra sincronizada** con `.lrc` (resaltado automático de la línea activa)
- **Modo Solo letra** para proyección
- **Pantalla completa** optimizada para proyectores

## Estructura del Proyecto

```
himnarioAdventista/
├── server.py                  # servidor local con fallback SPA
├── index.html                 # shell SPA (vista inicio + vista himno)
├── sync_lyrics.py             # proceso masivo: --all / --id / --force
├── sync-report.json           # informe de la última ejecución masiva
├── tools/
│   ├── vocal_sync.py          # motor de alineación vocal (Whisper) -> .sync.json
│   └── requirements-sync.txt
├── src/
│   ├── css/
│   │   └── index.css
│   ├── assets/
│   │   ├── fondos/
│   │   └── icons/
│   └── js/
│       ├── app.js             # bootstrap
│       ├── api/
│       │   └── hymnsApi.js    # catálogo, búsqueda, URLs de audio y letra
│       ├── core/
│       │   ├── config.js
│       │   ├── constants.js   # modos, atajos, campos requeridos
│       │   └── router.js      # router History API (/X?mode=...)
│       ├── services/
│       │   └── lyricsService.js  # carga .txt/.lrc + caché
│       ├── utils/
│       │   ├── lrcParser.js       # parser .lrc
│       │   ├── lyricsSplitter.js  # división en fragmentos
│       │   ├── fetchWithTimeout.js
│       │   └── validators.js
│       └── components/
│           ├── search/
│           ├── selector/
│           └── hymn/          # presentación: view, controller, modos, teclado
└── data/
    ├── himnario-api.json
    ├── audios/
    │   ├── cantadas/
    │   └── instrumentales/
    ├── letras/                # .txt + .lrc (mismo nombre)
    └── sync/                  # *.sync.json (sincronización vocal)
```

## Tecnologías

HTML5, CSS3 y JavaScript nativo (módulos ES). Sin dependencias ni build.

## Formato de Datos

### Catálogo (`data/himnario-api.json`)

```json
{
  "id": 1,
  "number": 1,
  "title": "Cantad alegres al Senor",
  "mp3Route": "/audios/cantadas/001 - Cantad alegres al Senor.mp3",
  "mp3RouteInstr": "/audios/instrumentales/001 - Cantad alegres al Senor.mp3",
  "mp3Filename": "001 - Cantad alegres al Senor.mp3",
  "bibleReference": "Salmos 100:1-5",
  "txtRoute": "/letras/001 - Cantad alegres al Senor.txt"
}
```

### Letra (`data/letras/*.txt`)

Números de estrofa, opcional `Coro`, líneas de letra y líneas vacías como separadores.

### Prioridad de la sincronización

**Cantado** y **Karaoke** resuelven los tiempos en este orden:

1. **Alineación vocal** (`data/sync/*.sync.json`, generado con `tools/vocal_sync.py`):
   `syncMethod = "vocal-alignment"`. Tiempos por frase obtenidos de la voz real del
   MP3. **No muestra ninguna advertencia.**
2. **LRC revisado** (`data/letras/*.lrc`) cuyo texto cubra toda la secuencia,
   incluidas las repeticiones del coro.
3. **Estimación acústica de respaldo** (`syncMethod = "estimated"`): reparte la duración
   por longitud vocal de cada frase y la ajusta a mínimos de energía. Puede venir
   guardada en el `.sync.json` o calcularse en el navegador. Muestra
   «Sincronización aproximada según el audio…».

### Letra sincronizada (`data/letras/*.lrc`)

El `.lrc` del himno se resuelve con una única función (`getHymnLrcUrls`), que prueba
en orden estas convenciones y usa la primera que exista:

1. Mismo nombre que la letra: `data/letras/001 - Cantad alegres al Senor.lrc`
2. Mismo nombre que el mp3: `data/letras/001 - Cantad alegres al Senor.lrc`
3. Por número con ceros: `data/letras/001.lrc`

```text
[00:00.00]Cantad alegres al Señor,
[00:04.00]mortales todos por doquier;
```

Así, para agregar sincronización a un himno solo hay que crear el archivo; no se edita
el JSON. **Cantado** y **Karaoke** usan exactamente el mismo `.lrc`; únicamente cambia
el audio (`mp3Route` vs `mp3RouteInstr`). Ambas grabaciones deben compartir arreglo,
entrada y tempo; una duración parecida no garantiza que las frases coincidan.

> Ejemplo incluido: `data/letras/001 - Cantad alegres al Senor.lrc` (timestamps aproximados).
> El `.sync.json` del mismo himno tiene prioridad sobre este `.lrc`.

### Sincronización vocal (`data/sync/*.sync.json`)

Archivo aparte que **no reemplaza al TXT**: solo aporta los tiempos. Vive en
`data/sync/` y se resuelve con `getHymnSyncUrls` usando las mismas convenciones de
nombre que el `.lrc` (nombre de la letra, nombre del mp3 o número con ceros, con
extensión `.sync.json`).

```json
{
  "syncMethod": "vocal-alignment",
  "confidence": 0.66,
  "needsReview": false,
  "lines": [
    {
      "type": "verse",
      "verse": 1,
      "occurrence": 0,
      "text": "Cantad alegres al Señor,",
      "start": 26.86,
      "end": 35.06,
      "confidence": 0.735
    }
  ]
}
```

La letra mostrada **sigue saliendo del `.txt`**: el JSON solo aporta `start`, `end` y
`confidence`. Si la letra cambia (distinta cantidad de fragmentos), el `.sync.json` se
ignora por obsoleto y se cae al respaldo. Para generarlo, ver
[Generar la sincronización vocal](#generar-la-sincronización-vocal).

`syncMethod` puede ser `vocal-alignment` (voz real) o `estimated` (respaldo aproximado).
La web muestra la advertencia **solo** cuando es `estimated`. `needsReview` marca los
archivos con confianza baja para revisarlos después.

### Diagnóstico de `.lrc`

Para ver qué ruta se intenta y su estado HTTP, abre la URL con `?debug=lrc`
(o ejecuta `localStorage.lrcDebug = "1"` en la consola):

```text
[LRC] himno 25 -> /data/letras/025 - Siento la presencia del Senor.lrc -> HTTP 404
[LRC] himno 25 -> /data/letras/025.lrc -> HTTP 200
[LRC] himno 25: 18 líneas parseadas
```

Si no existe `.sync.json` y todas las rutas `.lrc` dan `404`, se estima la
sincronización a partir del audio (respaldo marcado como aproximado).

## Generar la sincronización vocal

Requiere Python 3 y `ffmpeg` en el sistema. Whisper se ejecuta **en local**; las
grabaciones no se envían a ningún servicio. El punto de entrada es `sync_lyrics.py`
(usa `.venv` automáticamente si falta `faster-whisper`).

```bash
python3 -m venv .venv
.venv/bin/pip install -r tools/requirements-sync.txt

# Todo el himnario (omite los himnos ya sincronizados; reanudable)
python3 sync_lyrics.py --all --workers 3

# Un himno concreto, o varios
python3 sync_lyrics.py --id 25
python3 sync_lyrics.py --id 25 26 40

# Forzar la regeneración (ignora los .sync.json existentes)
python3 sync_lyrics.py --all --force
python3 sync_lyrics.py --id 25 --force
```

El proceso:

```text
MP3 cantado + TXT
      ↓  Whisper (timestamps por palabra)
palabras reconocidas en el audio
      ↓  alineación (Needleman-Wunsch + Levenshtein, sin tildes ni signos)
frases oficiales del TXT con su tiempo
      ↓
data/sync/<nombre>.sync.json
```

- La letra del `.txt` es la fuente oficial: la transcripción **solo** sirve para saber
  cuándo se canta cada frase. El texto del JSON nunca se muestra.
- El **coro** se expande en memoria tras cada estrofa y la alineación asigna a cada
  aparición su propia posición en el audio, aunque el TXT solo lo escriba una vez.
- Cada frase lleva `start`, `end` y `confidence`; el archivo incluye `syncMethod`,
  la `confidence` global y `needsReview`.
- **Reanudable:** omite los himnos cuyo `.sync.json` ya es válido
  (`vocal-alignment` o `estimated`). `--force` los rehace.
- **Respaldo:** si la voz no se reconoce o la confianza queda por debajo de
  `--min-confidence` (0.25), se escribe `syncMethod = "estimated"` con
  `needsReview: true`. La web muestra entonces la advertencia.
- `needsReview: true` también cuando la confianza vocal queda por debajo de
  `--review-threshold` (0.6), aunque los tiempos sean reales.
- Al terminar se escribe `sync-report.json` con los totales y los IDs a revisar.

Opciones: `--model {tiny,base,small,medium,large-v3}` (por defecto `medium`; `large-v3`
es más preciso pero mucho más lento en CPU), `--device cuda`, `--workers N` (cada
proceso carga el modelo una sola vez), `--report RUTA`, `--no-report`.

Ejemplo de salida:

```text
[SKIP]    1 - ya sincronizado
[OK]      2 - confidence: 0.97
[WARN]    7 - confidence: 0.52 - necesita revisión
[ERROR]  48 - archivo TXT no encontrado
```

> **WhisperX** no es instalable en Python 3.14 (fija `faster-whisper==1.0.0` →
> `ctranslate2==4.4.0`, sin wheel para 3.14). Por eso se usa `faster-whisper`, que
> aporta el mismo tipo de timestamps por palabra sin arrastrar PyTorch.

El VAD está desactivado por defecto: al estar entrenado para habla, descarta el canto.
Actívalo con `--vad` solo si el audio tiene mucho silencio y poco acompañamiento.

> El proceso masivo dura horas (≈1 min por himno y worker en CPU con `medium`).
> Con `--workers 3` y 16 núcleos conviene vigilar la RAM: cada worker usa ~1.3 GB.

## Licencia

Proyecto personal para uso en iglesia.


## Estructura y sincronización de frases

`hymnParser.js` interpreta números de estrofa y marcadores `Coro`/`Estribillo`,
ignorando espacios adicionales y tolerando saltos de línea distintos. Devuelve
`verses`, `chorus` y `sequence`. El coro se inserta en memoria después de cada
estrofa. No se modifican los TXT ni el divisor utilizado por **Solo letra**.

`lyricsTimeline.js` convierte esa secuencia en fragmentos con `type`, `verse`
(cuando corresponde), `occurrence`, `text`, `start` y `end` en segundos.

- La **alineación vocal** (`.sync.json`) tiene prioridad: sus tiempos provienen del canto
  real y no muestran advertencia. Debe cubrir exactamente los fragmentos del TXT; si no
  coincide (por ejemplo, porque la letra cambió), se ignora.
- Después, un LRC cuyo texto cubra toda la secuencia, incluidas las repeticiones. Se
  respetan sus marcas, `offset` y entradas vacías para pausas. El LRC puede dividir las
  frases de forma diferente al TXT.
- Como último recurso, `audioAnalysis.js` decodifica la grabación localmente con Web
  Audio. Estima límites mediante longitud vocal aproximada de las frases y mínimos de
  energía cercanos; recorta silencio inicial y final. No divide la duración en partes
  iguales. La envolvente se conserva en caché y se libera el audio decodificado. No se
  envían grabaciones a servicios externos.
- Esta estimación **no reconoce el canto**: acompañamiento, introducciones, interludios,
  melismas o arreglos diferentes pueden desplazarla. Por eso se marca
  `syncMethod = "estimated"` y se indica «Sincronización aproximada» en pantalla.
- Si la descarga o decodificación falla, se conserva la letra completa como respaldo.
  El análisis remoto requiere que el servidor de audio permita CORS.

Cantado y Karaoke utilizan el mismo servicio y el mismo motor. La letra se **adelanta
1 segundo** al audio (`LYRICS_LEAD_SECONDS` en `audioMode.js`): cada frase se muestra
antes de cantarse. El reproductor
consulta `currentTime` en reproducción y al adelantar/retroceder, sin acumular
retrasos mediante temporizadores. La esquina indica la estrofa o coro actual;
la frase anterior se atenúa y la siguiente se prepara debajo. `L` mantiene la
vista completa y permite saltar haciendo clic en una frase.

### Pruebas

Con Node.js 22.18+ o 24+ (módulos ES detectados automáticamente):

```bash
node --test tests/lyrics.test.mjs
```

Se comprueban los 613 TXT de la colección, incluyendo todos los pasos de
estrofa a coro y del coro a la siguiente estrofa, variantes de marcadores,
LRC, pausas, búsquedas hacia atrás y límites de reproducción. Estas pruebas
verifican estructura y lógica; no certifican coincidencia con la voz cantada.


Pruebas del servidor y de reproducción en Chromium (servidor iniciado en otra terminal):

```bash
python3 -B -m unittest discover -s tests -p 'test_*.py'
npm install --prefix /tmp/hymn-playwright playwright
/tmp/hymn-playwright/node_modules/.bin/playwright install chromium
PLAYWRIGHT_MODULE=/tmp/hymn-playwright/node_modules/playwright/index.mjs node tests/browser-lyrics.mjs
```

`TEST_BASE_URL` permite usar otro puerto y `TEST_HYMNS=524` limita la prueba a un
himno. Por defecto se prueban 1, 8, 83, 379, 524 y 585 en ambos modos, con audios
reales, cambios de sección, saltos, reproducción, lista y fin; también Solo letra.
El servidor local admite rangos HTTP para que adelantar y retroceder funcione.
Reinicia `server.py` después de actualizarlo.
