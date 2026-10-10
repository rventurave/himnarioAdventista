#!/usr/bin/env python3
"""Publica solo archivos estáticos; nunca accede a data/audios."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "dist"


def build():
    OUTPUT.mkdir(exist_ok=True)
    shutil.copy2(ROOT / "index.html", OUTPUT / "index.html")
    shutil.copytree(ROOT / "src", OUTPUT / "src", dirs_exist_ok=True)
    (OUTPUT / "data").mkdir(exist_ok=True)
    shutil.copy2(ROOT / "data/himnario-api.json", OUTPUT / "data/himnario-api.json")
    for directory in ("letras", "sync"):
        shutil.copytree(ROOT / "data" / directory, OUTPUT / "data" / directory, dirs_exist_ok=True)
    catalog = json.loads((ROOT / "data/himnario-api.json").read_text())
    # Reescrituras explícitas: los TXT/JSON ausentes deben devolver 404, no HTML.
    redirects = [f"/{h['number']} /index.html 200" for h in catalog]
    (OUTPUT / "_redirects").write_text("\n".join(redirects) + "\n")
    (OUTPUT / "404.html").write_text('<!doctype html><html lang="es"><meta charset="utf-8"><title>No encontrado</title><p>Archivo no encontrado.</p><a href="/">Volver al himnario</a></html>')
    print(f"Preparado: {OUTPUT} ({len(catalog)} himnos; sin MP3)")


if __name__ == "__main__":
    build()
