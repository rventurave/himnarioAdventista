# Himnario Adventista Interactivo

Aplicación web para proyectar himnos del Himnario Adventista con audio cantado, instrumental y letra sincronizada.

## Requisitos

- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Un servidor local para ejecutar la aplicación (no funciona con `file://`)

## Ejecución

### Opción 1 — Python
```bash
cd himnarioAdventista
python3 -m http.server 8000
```
Abrir `http://localhost:8000`

### Opción 2 — Node.js
```bash
cd himnarioAdventista
npx serve .
```

### Opción 3 — http-server
```bash
cd himnarioAdventista
npx http-server .
```

## Funcionalidades

- **Búsqueda** por número o título (con debounce de 300ms)
- **613 himnos** del Himnario Adventista
- **Audio cantado** e **instrumental** con cambio en tiempo real
- **Letra sincronizada** con el audio (resaltado automático de verso)
- **Modo letra sola** para proyección (oculta todos los controles)
- **Pantalla completa** optimizada para proyectores
- **Imagen de fondo** personalizable sobre la letra
- **Control total por teclado**
- **Responsive**: móvil, tablet, desktop y pantallas grandes/proyector

## Controles de Teclado

| Tecla | Acción |
|-------|--------|
| `Espacio` | Reproducir / Pausar |
| `←` | Retroceder 5 segundos |
| `→` | Adelantar 5 segundos |
| `M` | Silenciar / Activar sonido |
| `1` | Cambiar a audio cantado |
| `2` | Cambiar a audio instrumental |
| `L` | Toggle modo letra sola |
| `F` | Toggle pantalla completa |
| `Esc` | Volver al buscador |

> Los atajos de teclado no se activan cuando el cursor está en el campo de búsqueda.

## Estructura del Proyecto

```
himnarioAdventista/
├── index.html
├── himnario-api.json          # Catálogo de 613 himnos
├── css/
│   ├── main.css               # Variables, reset, layout base
│   ├── search.css             # Buscador y lista de resultados
│   ├── hymn-view.css          # Vista del himno seleccionado
│   ├── audio-controls.css     # Barra de reproducción
│   ├── lyrics.css             # Letra sincronizada + modo letra sola
│   ├── responsive.css         # Media queries (móvil → desktop)
│   └── projector.css          # Estilos para proyector (≥1440px)
├── js/
│   ├── app.js                 # Punto de entrada, orquesta componentes
│   ├── core/
│   │   ├── eventBus.js        # Sistema pub/sub (on/off/emit)
│   │   └── stateManager.js    # Estado central de la aplicación
│   ├── services/
│   │   ├── apiService.js      # Fetch del catálogo y letras (.txt)
│   │   ├── fileParser.js      # Parseo de letras a versos
│   │   └── keyboardService.js # Mapeo de teclas a acciones
│   ├── components/
│   │   ├── searchbar.js       # Input de búsqueda con debounce
│   │   ├── hymnList.js        # Lista de resultados
│   │   ├── hymnDetail.js      # Info del himno + fetch de letra
│   │   ├── audioPlayer.js     # Control de <audio> nativo
│   │   ├── lyricsDisplay.js   # Renderizado y sincronización de letra
│   │   └── modeToggle.js      # Modo letra sola, fondo, fullscreen
│   └── utils/
│       ├── constants.js       # URLs, teclas, eventos, modos
│       └── dom.js             # Helpers de manipulación DOM
├── assets/
│   ├── bg/                    # Imágenes de fondo
│   └── icons/                 # SVGs de controles
└── dataBase/
    ├── audios/
    │   ├── cantadas/          # MP3 cantados
    │   └── instrumentales/    # MP3 instrumentales
    └── letras/                # Archivos .txt de letra
```

## Arquitectura

### Patrón: Módulos ES6 + EventBus + Estado Centralizado

```
┌─────────────────────────────────────────────────┐
│               PRESENTATION (Componentes)         │
│  SearchBar │ HymnList │ HymnDetail │ LyricsDisplay │
│            │ AudioPlayer │ ModeToggle              │
├─────────────────────────────────────────────────┤
│                  EVENT BUS (Pub/Sub)              │
├─────────────────────────────────────────────────┤
│              STATE MANAGER (Fuente única)         │
├─────────────────────────────────────────────────┤
│            SERVICES (API, Parser, Teclado)        │
└─────────────────────────────────────────────────┘
```

### Comunicación entre módulos

Los módulos **nunca** se importan entre sí directamente. La comunicación se realiza a través de un **EventBus** (patrón pub/sub):

```javascript
// Un módulo emite un evento
eventBus.emit('hymn:selected', hymn);

// Otro módulo escucha
eventBus.on('hymn:selected', (hymn) => this._loadHymn(hymn));
```

### Estado central

Un solo **StateManager** contiene todo el estado de la aplicación:

```javascript
{
  hymns: [],                 // Catálogo completo
  filteredHymns: [],         // Resultados de búsqueda
  currentHymn: null,         // Himno seleccionado
  lyrics: [],                // Versos parseados
  isPlaying: false,          // Estado de reproducción
  audioMode: 'cantado',      // 'cantado' | 'instrumental'
  lyricsOnlyMode: false,     // Modo proyección
  currentTime: 0,            // Tiempo actual del audio
  duration: 0,               // Duración total
  activeVerseIndex: -1,      // Verso resaltado
  backgroundImage: null,     // Imagen de fondo
  searchQuery: '',           // Texto de búsqueda
  isLoading: false,          // Estado de carga
  error: null                // Mensaje de error
}
```

Ningún módulo modifica el estado directamente. Todos usan `setState()`.

### Sincronización de letra

Como los archivos `.txt` no tienen timestamps, la sincronización es **proporcional**:

```
duración_total / número_de_versos = tiempo_por_verso

verso 0: 0s – 8s
verso 1: 8s – 16s
verso 2: 16s – 24s
...
```

El componente `lyricsDisplay` escucha `AUDIO_TIMEUPDATE` (emitido ~60 veces por segundo vía `requestAnimationFrame`) y resalta el verso activo.

## Tecnologías

- **HTML5** — Semántica, Audio API, Fullscreen API
- **CSS3** — Custom Properties, Flexbox, Media Queries, :fullscreen
- **JavaScript ES6+** — Módulos, Classes, Async/Await, Fetch API
- **Sin dependencias externas** — No usa frameworks ni librerías

## Formato de Datos

### Catálogo (`himnario-api.json`)
```json
{
  "id": 1,
  "number": 1,
  "title": "Cantad alegres al Senor",
  "mp3Route": "/dataBase/audios/cantadas/001 - Cantad alegres al Senor.mp3",
  "mp3RouteInstr": "/dataBase/audios/instrumentales/001 - Cantad alegres al Senor.mp3",
  "mp3Filename": "001 - Cantad alegres al Senor.mp3",
  "bibleReference": "Salmos 100:1-5",
  "txtRoute": "/dataBase/letras/001 - Cantad alegres al Senor.txt"
}
```

### Letra (`.txt`)
```
1
Cantad alegres al Señor,
mortales todos por doquier;
servidle siempre con fervor,
obedecedle con placer.

2
Con gratitud canción alzad
al Hacedor que el ser os dio;
```

El parser reconoce:
- Números de verso (`1`, `2`, `3`...)
- Coro (`Coro`)
- Líneas de letra
- Líneas vacías como separadores de verso

## Responsive

| Breakpoint | Dispositivo |
|------------|-------------|
| `< 480px` | Móvil |
| `480 – 768px` | Tablet |
| `768 – 1024px` | Desktop |
| `> 1024px` | Desktop grande |
| `≥ 1440px` | Proyector |
| `≥ 1920px` | Ultra-wide |

## Licencia

Proyecto personal para uso en iglesia.
