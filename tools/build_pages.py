#!/usr/bin/env python3
"""Publica solo archivos estáticos; nunca accede a data/audios."""
import json
import shutil
from pathlib import Path
try:
    from .seo_pages import hymn_page, index_page, sitemap, font_stylesheets
except ImportError:
    from seo_pages import hymn_page, index_page, sitemap, font_stylesheets

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "dist"


def build():
    OUTPUT.mkdir(exist_ok=True)
    shutil.copy2(ROOT / "index.html", OUTPUT / "index.html")
    shutil.copy2(ROOT / "robots.txt", OUTPUT / "robots.txt")

    # Conserva ambas verificaciones originales hasta confirmar la nueva cuenta.
    for verification in ("google559bc240c1dea629.html", "google3fcf1a30d77a5e34.html"):
        shutil.copy2(ROOT / verification, OUTPUT / verification)
    shutil.copytree(ROOT / "src", OUTPUT / "src", dirs_exist_ok=True)
    (OUTPUT / "data").mkdir(exist_ok=True)
    shutil.copy2(ROOT / "data/himnario-api.json", OUTPUT / "data/himnario-api.json")
    for directory in ("letras", "sync"):
        shutil.copytree(ROOT / "data" / directory, OUTPUT / "data" / directory, dirs_exist_ok=True)
    catalog = json.loads((ROOT / "data/himnario-api.json").read_text())
    # Reescrituras explícitas: los TXT/JSON ausentes deben devolver 404, no HTML.
    numbers = [h['number'] for h in catalog]
    if sorted(numbers) != list(range(1, 614)):
        raise ValueError('Se requieren los números únicos 1 a 613')
    template = (ROOT / 'index.html').read_text()
    (OUTPUT / '_hymns').mkdir(exist_ok=True)
    for hymn in catalog:
        (OUTPUT / "_hymns" / f"{hymn['number']}.html").write_text(hymn_page(template, hymn, ROOT), encoding='utf-8')
    (OUTPUT / 'himnos.html').write_text(index_page(catalog), encoding='utf-8')
    (OUTPUT / 'sitemap.xml').write_text(sitemap(catalog), encoding='utf-8')
    redirects = [f"/{h['number']} /_hymns/{h['number']} 200" for h in catalog]
    (OUTPUT / "_redirects").write_text("\n".join(redirects) + "\n")
    (OUTPUT / "404.html").write_text(f'<!doctype html><html lang="es"><head><meta charset="utf-8"><title>No encontrado</title>{font_stylesheets()}</head><body><p>Archivo no encontrado.</p><a href="/">Volver al himnario</a></body></html>', encoding='utf-8')
    print(f"Preparado: {OUTPUT} ({len(catalog)} himnos; sin MP3)")


if __name__ == "__main__":
    build()
