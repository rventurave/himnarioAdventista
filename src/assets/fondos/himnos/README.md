# Fondos por himno

Guarda aquí las imágenes propias de cada himno, por ejemplo `001.webp`,
`002.jpg` o `613.webp`. No hace falta duplicar el fondo predeterminado.

En `data/himnario-api.json`, asigna el campo `backgroundImage` del himno:

```json
"backgroundImage": "/src/assets/fondos/himnos/001.webp"
```

Usa `null` para mantener el fondo actual (`src/assets/fondos/fondo.png`).
También se usa ese fondo si la imagen asignada no puede cargarse. La portada
siempre conserva el fondo predeterminado. El fondo personalizado se aplica en
los tres modos: Letra, Cantado y Karaoke.

Las imágenes se incluyen automáticamente en la salida de `tools/build_pages.py`.
