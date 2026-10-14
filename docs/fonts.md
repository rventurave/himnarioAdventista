# Tipografía y licencias

Bebas Neue Regular (400) para títulos y encabezados; Nunito Regular (400)
para textos de interfaz y referencias bíblicas, y SemiBold (600) para letras,
estrofas, coros y botones destacados.

Ambas familias se cargan en una única hoja de Google Fonts con `display=swap`.
Solo se solicitan los pesos 400 de Bebas Neue y 400/600 de Nunito.
Se usan alternativas Arial Narrow/sans-serif y system-ui/sans-serif.

Ambas fuentes tienen licencia SIL Open Font License 1.1:
- [Bebas Neue y licencia](https://github.com/google/fonts/tree/main/ofl/bebasneue).
- [Nunito y licencia](https://github.com/google/fonts/tree/main/ofl/nunito).

No se incluyen ni modifican binarios de fuentes. `src/css/typography.css`
define las familias reutilizables. Los HTML prerenderizados, el índice y la
página 404 heredan las etiquetas de fuentes de `index.html`.

Los títulos visibles de himnos usan mayúsculas mediante CSS; el contenido
original permanece intacto. Se conservan tamaños, colores y distribución.

Verificaciones:
```sh
python3 tools/build_pages.py
python3 -B -m unittest discover -s tests
node --test tests/*.test.mjs
TEST_BASE_URL=http://127.0.0.1:3400 node tests/browser-fonts.mjs
```
