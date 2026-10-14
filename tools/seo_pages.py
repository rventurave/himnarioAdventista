"""HTML indexable generado exclusivamente desde el catálogo y las letras locales."""
from html import escape
import re
from pathlib import Path

ORIGIN = 'https://himnario-adventista.pages.dev'
HOME_TITLE = 'Himnario Adventista del Séptimo Día | 613 Himnos'
HOME_DESCRIPTION = 'Himnario Adventista del Séptimo Día con 613 himnos. Consulta las letras, escucha audios cantados e instrumentales y utiliza el modo karaoke.'


def metadata(html, title, description, path):
    html = re.sub(r'<title>.*?</title>', '<title>' + escape(title) + '</title>', html)
    for key, value in [('description', description), ('og:title', title), ('og:description', description), ('og:url', ORIGIN + path)]:
        attr = 'property' if key.startswith('og:') else 'name'
        html = re.sub(rf'(<meta\s+{attr}="{key}"\s+content=")[^"]*("\s*/>)', lambda m: m[1] + escape(value, quote=True) + m[2], html)
    return re.sub(r'(<link\s+rel="canonical"\s+href=")[^"]*("\s*/>)', lambda m: m[1] + ORIGIN + path + m[2], html)


def hymn_page(template, hymn, root):
    number, title = hymn['number'], hymn['title']
    lyrics_path = root / 'data' / hymn['txtRoute'].lstrip('/')
    if not lyrics_path.resolve().is_relative_to((root / 'data/letras').resolve()):
        raise ValueError('Ruta de letra fuera de data/letras')
    lyrics = lyrics_path.read_text(encoding='utf-8').strip()
    if not lyrics or len(lyrics.splitlines()) < 3:
        raise ValueError(f'Letra vacía o incompleta: {number}')
    heading = f'Himno {number}: {title}'
    html = metadata(template, f'{heading} | Himnario Adventista', f'{heading}. Consulta su letra en el Himnario Adventista y utiliza los modos cantado, instrumental y karaoke.', f'/{number}')
    html = html.replace('<section id="view-home" class="view">', '<section id="view-home" class="view" hidden>')
    article = f'''<article id="static-hymn" class="static-hymn">
      <a href="/">Himnario Adventista</a>
      <h1>{escape(heading)}</h1>
      <p>Letra del himno {number} del Himnario Adventista del Séptimo Día. Con JavaScript puedes utilizar los modos cantado, instrumental y karaoke.</p>
      <p>{escape(hymn.get('bibleReference') or '')}</p>
      <h2>Letra</h2><p class="static-lyrics">{escape(lyrics)}</p>
      <a href="/himnos">Ver los 613 himnos adventistas</a>
    </article>'''
    return html.replace('<main id="app">', '<main id="app">' + article)


def font_stylesheets():
    template = (Path(__file__).resolve().parent.parent / 'index.html').read_text(encoding='utf-8')
    return '\n'.join(tag for tag in re.findall(r'<link\b[^>]*>', template) if any(token in tag for token in (
        'fonts.gstatic.com', 'fonts.googleapis.com', '/src/css/typography.css'
    )))


def index_page(catalog):
    font_links = font_stylesheets()
    links = '\n'.join(f'<li><a href="/{h["number"]}">{h["number"]}. {escape(h["title"])}</a></li>' for h in catalog)
    return f'''<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Índice de los 613 himnos adventistas | Himnario Adventista</title>
<meta name="description" content="Consulta los 613 himnos adventistas por número y título y accede a sus letras, música y karaoke.">
<link rel="canonical" href="{ORIGIN}/himnos"><meta name="viewport" content="width=device-width, initial-scale=1">
{font_links}
</head><body><main><a href="/">Himnario Adventista</a><h1>Índice de los 613 himnos adventistas</h1><ol>{links}</ol></main></body></html>'''


def sitemap(catalog):
    paths = ['/', '/himnos', *(f'/{h["number"]}' for h in catalog)]
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{ORIGIN}{path}</loc></url>\n' for path in paths) + '</urlset>\n'
