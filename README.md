# Himnario Adventista

Aplicación web para buscar, visualizar y reproducir los **613 himnos del Himnario Adventista**, con audio cantado, instrumental y letras sincronizadas. Pensada para uso personal y proyección en iglesia.

**Sitio web:** https://himnario-adventista.pages.dev/

## Funcionalidades

- Búsqueda por número o título.
- Tres modos: Solo letra, Cantado y Karaoke.
- Presentación de letras por bloques y vista de letra completa en los modos con audio.
- Pantalla completa para proyección.
- Fondos personalizados por himno.
- Diseño adaptable a computadoras y móviles, con atajos de teclado.

## Modos de reproducción

| Modo | Descripción |
| --- | --- |
| **Solo letra** | Muestra la letra sin audio, con avance automático si hay tiempos disponibles; las flechas adelantan o retroceden 1 segundo. Sin tiempos, las flechas cambian de bloque. |
| **Cantado** | Reproduce la grabación cantada y muestra la letra sincronizada. |
| **Karaoke** | Reproduce el instrumental y muestra la letra con los tiempos de la versión cantada. |

La precisión de la sincronización depende de los tiempos disponibles para cada himno.

## Atajos de teclado

| Tecla | Acción |
| --- | --- |
| `Espacio` | Reproducir o pausar el audio; en Solo letra, pausar o reanudar el avance automático si hay tiempos disponibles. |
| `←` / `→` | Retroceder o adelantar 1 segundo en Solo letra (sin tiempos, cambia de bloque); 5 segundos en Cantado y Karaoke. |
| `L` | Alternar entre la presentación por bloques y la letra completa en Cantado y Karaoke. |
| `F` | Alternar la pantalla completa con un himno abierto. |
| `Tab` | Alternar la pantalla completa desde el buscador o cuando el foco está en el fondo de la página. Desde otros controles conserva la navegación habitual. |
| `Esc` | Volver al buscador desde un himno. Según el navegador, puede salir primero de pantalla completa y requerir otra pulsación. |

Los atajos del himno no se activan mientras se escribe en un campo. `Shift` + `Tab` conserva la navegación inversa entre controles.

## Tecnologías utilizadas

- HTML5, CSS3 y JavaScript nativo para la aplicación.
- Python 3 para el servidor local y la preparación del sitio estático.
- Cloudflare Pages para el alojamiento web y Cloudflare R2 para los audios.

## Estructura del proyecto

```text
himnarioAdventista/
├── README.md
├── index.html
├── server.py                   # Servidor local
├── sync_lyrics.py              # Herramienta de sincronización
├── data/
│   ├── himnario-api.json       # Catálogo de los 613 himnos
│   ├── letras/                # Letras .txt y sincronización .lrc
│   └── sync/                  # Archivos .sync.json
├── src/
│   ├── css/
│   ├── js/                    # Aplicación, componentes y servicios
│   └── assets/
│       ├── bg/
│       ├── icons/
│       └── fondos/
│           ├── fondo.png      # Fondo predeterminado
│           └── himnos/        # Fondos personalizados
├── tools/
│   ├── build_pages.py         # Genera dist/ para publicación
│   ├── seo_pages.py
│   ├── vocal_sync.py
│   └── requirements-sync.txt
├── tests/
└── dist/                      # Salida generada para Cloudflare Pages
```

Los MP3 se sirven desde Cloudflare R2; no hay una carpeta local de audios en el repositorio.

## Especificación de datos

### Catálogo de himnos — `data/himnario-api.json`

Contiene una lista de objetos, uno por himno, con estos campos principales:

| Campo | Descripción |
| --- | --- |
| `id` | Identificador del himno. |
| `number` | Número del himno. |
| `title` | Título. |
| `mp3Route` | Ruta del audio cantado dentro del almacenamiento de audios. |
| `mp3RouteInstr` | Ruta del audio instrumental dentro del almacenamiento de audios. |
| `mp3Filename` | Nombre del archivo MP3. |
| `bibleReference` | Referencia bíblica. |
| `txtRoute` | Ruta de la letra, relativa a `data/`. |
| `backgroundImage` | Ruta de la imagen de fondo; `null` conserva el fondo predeterminado. |

Ejemplo real del catálogo, con sus nombres originales:

```json
{
  "id": 1,
  "number": 1,
  "title": "Cantad alegres al Senor",
  "mp3Route": "/audios/cantadas/001 - Cantad alegres al Senor.mp3",
  "mp3RouteInstr": "/audios/instrumentales/001 - Cantad alegres al Senor.mp3",
  "mp3Filename": "001 - Cantad alegres al Senor.mp3",
  "bibleReference": "Salmos 100:1-5",
  "txtRoute": "/letras/001 - Cantad alegres al Senor.txt",
  "backgroundImage": null
}
```

### Archivos MP3

La aplicación reproduce los audios desde **Cloudflare R2**, usando la base configurada en `src/js/core/config.js`:

```text
https://pub-1ca54579e235492c815179e37558122a.r2.dev/data/audios/
```

En ese almacenamiento, `cantadas/` contiene las grabaciones con voz e `instrumentales/` las pistas para Karaoke. Los nombres siguen el formato `NNN - Titulo.mp3`, con el número de tres dígitos y el título tal como figura en `mp3Filename`.

`mp3Route` y `mp3RouteInstr` relacionan cada himno con su versión de audio. Por ejemplo, `/audios/cantadas/001 - Cantad alegres al Senor.mp3` se resuelve bajo la base de R2 como `cantadas/001%20-%20Cantad%20alegres%20al%20Senor.mp3`.

**Cloudflare Pages aloja el sitio web y sus datos de texto e imágenes; los MP3 se alojan por separado en R2.**

### Letras TXT

Los 613 archivos `.txt` están en `data/letras/`. Cada himno los referencia mediante `txtRoute`: por ejemplo, `/letras/001 - Cantad alegres al Senor.txt` corresponde a `data/letras/001 - Cantad alegres al Senor.txt`.

Las estrofas se identifican con números en líneas independientes (`1`, `2`, etc.) y el coro con el encabezado `Coro` o `Estribillo`. Los renglones siguientes contienen las frases de cada sección; al presentar la letra, el coro se repite después de cada estrofa. El TXT es la fuente de la letra mostrada.

### Sincronización LRC

Los `.lrc` están en `data/letras/` y asocian frases con marcas de tiempo en formato `[mm:ss.xx]`. Se busca primero el mismo nombre del TXT con extensión `.lrc`; también se admiten el nombre del MP3 con esa extensión y el número de tres dígitos, como `001.lrc`.

Actualmente existe un solo LRC: `001 - Cantad alegres al Senor.lrc`. Este es un fragmento de su contenido:

```lrc
[00:00.00]Cantad alegres al Señor,
[00:04.00]mortales todos por doquier;
[00:08.00]servidle siempre con fervor,
```

Las marcas del ejemplo pertenecen al LRC y no representan los tiempos del archivo de sincronización vocal.

### Sincronización vocal JSON

Los archivos `data/sync/*.sync.json` guardan los tiempos de las frases para acompañar la reproducción. Se relacionan con el himno por el nombre del TXT o MP3, sustituyendo la extensión por `.sync.json`; también se admite `NNN.sync.json`.

| Campo | Descripción |
| --- | --- |
| `hymn`, `source`, `duration` | Número del himno, archivo de audio de referencia y duración en segundos. |
| `syncMethod` | Método: `vocal-alignment` para alineación con la voz o `estimated` para tiempos aproximados. |
| `confidence` | Nivel de confianza de la sincronización. |
| `needsReview` | Indicador de revisión pendiente, cuando está presente. |
| `lines` | Lista de frases con `text`, `start` y `end` en segundos. |
| `lines[].type`, `verse`, `occurrence` | Tipo de sección (`verse` o `chorus`), número de estrofa y posición de la sección en la secuencia. |
| `lines[].confidence`, `words` | Confianza por frase y tiempos por palabra, cuando están disponibles. |

La sincronización vocal alinea las frases con la voz de la grabación; una estimación aproximada distribuye tiempos sin garantizar esa coincidencia. Actualmente hay 613 archivos, todos marcados como `vocal-alignment`; esto no garantiza precisión perfecta.

La aplicación prioriza el `.sync.json`, después un LRC que cubra la secuencia completa y, en los modos con audio, una estimación aproximada si faltan tiempos utilizables. La letra sigue procediendo del TXT.

### Fondos de los himnos

El fondo predeterminado es `src/assets/fondos/fondo.png`. Las imágenes propias de cada himno están en `src/assets/fondos/himnos/` y se asignan con `backgroundImage` en el catálogo.

Por ejemplo, el himno 31 utiliza `31.png`; la asignación puede expresarse desde la raíz del sitio:

```json
{
  "backgroundImage": "/src/assets/fondos/himnos/31.png"
}
```

El fondo personalizado se aplica en los tres modos. Si el campo es `null` o la imagen no carga, se conserva el fondo predeterminado.

## Ejecución local

Requiere Python 3. No es necesario instalar dependencias para ejecutar el sitio.

```bash
git clone https://github.com/rventurave/himnarioAdventista.git
cd himnarioAdventista
python3 server.py
```

Abrir **http://localhost:3000**. Los audios requieren conexión a internet para acceder a R2.

Si el puerto está ocupado:

```bash
PORT=3001 python3 server.py
```

## Despliegue

Con Node.js y npm disponibles, y acceso a la cuenta de Cloudflare del proyecto:

```bash
python3 tools/build_pages.py
npx wrangler pages deploy dist --project-name=himnario-adventista --branch=main
```

El primer comando prepara `dist/` con el sitio, el catálogo, las letras, la sincronización y las imágenes, sin incluir MP3. El segundo publica esa carpeta en Cloudflare Pages.


## Uso

Busca un himno por número o título, selecciónalo y elige Solo letra, Cantado o Karaoke. Usa el botón de pantalla completa para proyectarlo y los controles o atajos para avanzar y manejar la reproducción.

Proyecto personal para uso en iglesia.
