#!/usr/bin/env python3
"""Punto de entrada de la sincronización vocal del himnario.

Es un envoltorio de `tools/vocal_sync.py` (el motor ya validado con el himno 1).
Si se ejecuta con el Python del sistema y falta faster-whisper, reintenta
automáticamente con el intérprete de `.venv`.

Uso:
    python sync_lyrics.py --all
    python sync_lyrics.py --all --force
    python sync_lyrics.py --id 25
    python sync_lyrics.py --id 25 --force
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def _ensure_dependencies() -> None:
    try:
        import faster_whisper  # noqa: F401
        return
    except ModuleNotFoundError:
        pass

    venv_python = ROOT / ".venv" / "bin" / "python"
    if venv_python.exists() and os.environ.get("SYNC_LYRICS_REEXEC") != "1":
        os.environ["SYNC_LYRICS_REEXEC"] = "1"
        os.execv(str(venv_python), [str(venv_python), str(Path(__file__).resolve()), *sys.argv[1:]])

    print(
        "Falta faster-whisper. Instálalo con:\n"
        "  python3 -m venv .venv\n"
        "  .venv/bin/pip install -r tools/requirements-sync.txt",
        file=sys.stderr,
    )
    raise SystemExit(1)


_ensure_dependencies()

sys.path.insert(0, str(ROOT / "tools"))
import vocal_sync  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(vocal_sync.main())
