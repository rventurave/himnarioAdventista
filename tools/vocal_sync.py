#!/usr/bin/env python3
"""Sincronización vocal del himnario.

Toma el MP3 cantado (o instrumental como respaldo) y el TXT oficial del himno,
transcribe el audio con Whisper (timestamps por palabra) y alinea esas palabras
contra la letra oficial del TXT. El resultado son tiempos reales por frase,
derivados de la voz, no de un reparto proporcional de la duración.

La transcripción automática NUNCA se usa como letra: solo sirve para descubrir
en qué momento del audio se canta cada fragmento del TXT.

Uso:
    python tools/vocal_sync.py 1
    python tools/vocal_sync.py 1 8 83
    python tools/vocal_sync.py --all
    python tools/vocal_sync.py --all --model medium
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import unicodedata
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "data" / "himnario-api.json"
LETRAS_DIR = ROOT / "data" / "letras"
SYNC_DIR = ROOT / "data" / "sync"
DEFAULT_REPORT = ROOT / "sync-report.json"
REVIEW_THRESHOLD = 0.6
ESTIMATED_CONFIDENCE = 0.45

# --- Reparto de la letra (debe replicar src/js/utils/hymnParser.js) ----------

VERSE_RE = re.compile(r"^(?:estrofa\s+)?(\d+)\s*[.):º°-]?$", re.IGNORECASE)
REFRAIN_RE = re.compile(r"^(?:coro|estribillo)\s*[:.:：-]?\s*$", re.IGNORECASE)
NUMBERED_RE = re.compile(r"^\s*(?:estrofa\s+)?\d+\s*[.):º°-]?\s*$", re.IGNORECASE)
PHRASE_SPLIT_RE = re.compile(r"(?<=[,.;:?!])\s+")


def parse_hymn(text: str) -> dict:
    """Replica parseHymn() de hymnParser.js."""
    verses: list[dict] = []
    chorus: dict | None = None
    section: dict | None = None

    rows = str(text or "").replace("\ufeff", "").split("\n")
    rows = [row[:-1] if row.endswith("\r") else row for row in rows]
    numbered = any(NUMBERED_RE.match(row) for row in rows)

    for raw in rows:
        line = raw.strip()
        verse = VERSE_RE.match(line)
        refrain = REFRAIN_RE.match(line)

        if verse:
            section = {"number": int(verse.group(1)), "lines": []}
            verses.append(section)
        elif refrain:
            section = {"lines": []}
            if not chorus or not chorus["lines"]:
                chorus = section
        elif line:
            if section is None:
                section = {"number": len(verses) + 1, "lines": []}
                verses.append(section)
            section["lines"].append(line)
        elif not numbered and section is not chorus:
            section = None

    nonempty = [verse for verse in verses if verse["lines"]]
    if not chorus or not chorus["lines"]:
        chorus = None

    sequence: list[dict] = []
    if nonempty:
        for verse in nonempty:
            sequence.append({"type": "verse", "number": verse["number"]})
            if chorus:
                sequence.append({"type": "chorus"})
    elif chorus:
        sequence.append({"type": "chorus"})

    return {"verses": nonempty, "chorus": chorus, "sequence": sequence}


def split_phrase(line: str) -> list[str]:
    """Replica splitPhrase() de hymnParser.js."""
    parts = PHRASE_SPLIT_RE.split(line)
    result: list[str] = []
    pending = ""
    for part in parts:
        pending = f"{pending} {part}" if pending else part
        if len(pending) >= 28:
            result.append(pending)
            pending = ""
    if pending:
        if result and len(pending) < 18:
            result[-1] = f"{result[-1]} {pending}"
        else:
            result.append(pending)
    return result


def expand_hymn(structure: dict) -> list[dict]:
    """Replica expandHymn() de hymnParser.js: fragmentos con su ocurrencia."""
    fragments: list[dict] = []
    for occurrence, section in enumerate(structure["sequence"]):
        source = structure["chorus"] if section["type"] == "chorus" else next(
            (verse for verse in structure["verses"] if verse["number"] == section["number"]),
            None,
        )
        for line in (source or {}).get("lines", []):
            for phrase in split_phrase(line):
                fragment = {"type": section["type"], "occurrence": occurrence, "text": phrase}
                if section["type"] == "verse":
                    fragment["verse"] = section["number"]
                fragments.append(fragment)
    return fragments


# --- Normalización y similitud ---------------------------------------------


def normalize_word(word: str) -> str:
    """Minúsculas, sin tildes ni signos: 'Traían;' -> 'traian'."""
    lowered = unicodedata.normalize("NFD", str(word)).lower()
    stripped = "".join(ch for ch in lowered if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9ñ]", "", stripped)


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if len(a) >= 3 and (a.startswith(b) or b.startswith(a)):
        return 0.9
    return SequenceMatcher(None, a, b).ratio()


# --- Alineación -------------------------------------------------------------


@dataclass
class AudioWord:
    start: float
    end: float
    seg_end: float  # fin del segmento de Whisper que lo contiene
    text: str
    norm: str


def align(target: list[str], audio: list[str], threshold: float = 0.6) -> list[tuple]:
    """Alineación global (Needleman-Wunsch) palabra objetivo -> palabra audio.

    Devuelve pares (indice_objetivo, indice_audio|None). Un None representa una
    palabra del TXT que no se reconoció en el audio.
    """
    n, m = len(target), len(audio)
    gap = -0.5
    mismatch = -1.1  # más caro que dos huecos: evita emparejar palabras ajenas
    match_scale = 2.0

    dp = [[0.0] * (m + 1) for _ in range(n + 1)]
    backtrack = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        dp[i][0] = dp[i - 1][0] + gap
        backtrack[i][0] = 1
    for j in range(1, m + 1):
        dp[0][j] = dp[0][j - 1] + gap
        backtrack[0][j] = 2

    for i in range(1, n + 1):
        ti = target[i - 1]
        row, prev = dp[i], dp[i - 1]
        for j in range(1, m + 1):
            score = similarity(ti, audio[j - 1])
            diagonal = prev[j - 1] + (score * match_scale if score >= threshold else mismatch)
            up = prev[j] + gap
            left = row[j - 1] + gap
            best, direction = diagonal, 0
            if up > best:
                best, direction = up, 1
            if left > best:
                best, direction = left, 2
            row[j] = best
            backtrack[i][j] = direction

    pairs: list[tuple] = []
    i, j = n, m
    while i > 0 or j > 0:
        direction = backtrack[i][j]
        if i > 0 and j > 0 and direction == 0:
            pairs.append((i - 1, j - 1))
            i -= 1
            j -= 1
        elif i > 0 and (j == 0 or direction == 1):
            pairs.append((i - 1, None))
            i -= 1
        else:
            pairs.append((None, j - 1))
            j -= 1
    pairs.reverse()
    return pairs


# --- Construcción de la línea de tiempo -------------------------------------


def build_timeline(fragments: list[dict], words: list[AudioWord], audio_end: float) -> tuple[list[dict], float]:
    target_norms: list[str] = []
    target_fragment: list[int] = []  # indice de palabra objetivo -> fragmento
    for index, fragment in enumerate(fragments):
        for word in fragment["text"].split():
            norm = normalize_word(word)
            if norm:
                target_norms.append(norm)
                target_fragment.append(index)

    audio_norms = [word.norm for word in words]
    pairs = align(target_norms, audio_norms)

    matched: list[dict[int, list[tuple[AudioWord, float]]]] = [{} for _ in fragments]
    for target_index, audio_index in pairs:
        if target_index is None or audio_index is None:
            continue
        score = similarity(target_norms[target_index], audio_norms[audio_index])
        if score < 0.6:
            continue
        matched[target_fragment[target_index]].setdefault(target_index, []).append(
            (words[audio_index], score)
        )

    lines: list[dict] = []
    total_weight = 0.0
    weighted_confidence = 0.0

    for index, fragment in enumerate(fragments):
        total_words = max(1, len([w for w in fragment["text"].split() if normalize_word(w)]))
        hits = [hit for group in matched[index].values() for hit in group]
        entry = dict(fragment)

        if hits:
            start = min(word.start for word, _ in hits)
            # El fin del segmento cubre sílabas que Whisper no reconoció palabra a palabra.
            end = max(max(word.end for word, _ in hits), max(word.seg_end for word, _ in hits))
            avg_sim = sum(score for _, score in hits) / len(hits)
            coverage = min(1.0, len(hits) / total_words)
            confidence = round(coverage * (0.4 + 0.6 * avg_sim), 3)
            entry["words"] = [
                {"word": word.text, "start": round(word.start, 2), "end": round(word.end, 2)}
                for word, _ in hits
            ]
        else:
            start = end = None
            confidence = 0.0

        entry["start"] = start
        entry["end"] = end
        entry["confidence"] = confidence
        lines.append(entry)

        total_weight += total_words
        weighted_confidence += confidence * total_words

    # Rellena huecos por interpolación entre frases vecinas con tiempo real.
    known = [i for i, line in enumerate(lines) if line["start"] is not None]
    if known:
        first, last = known[0], known[-1]
        for i in range(first):
            lines[i]["start"] = 0.0
            lines[i]["end"] = lines[first]["start"]
        for i in range(last + 1, len(lines)):
            lines[i]["start"] = lines[last]["end"]
            lines[i]["end"] = max(audio_end, lines[last]["end"])
        # Tramos sin coincidencia entre dos frases conocidas: reparto uniforme.
        i = first + 1
        while i < last:
            if lines[i]["start"] is not None:
                i += 1
                continue
            j = i
            while j < last and lines[j]["start"] is None:
                j += 1
            left, right = lines[i - 1]["end"], lines[j]["start"]
            count = j - i + 1
            span = max(0.0, right - left)
            for k in range(i, j + 1):
                lines[k]["start"] = left + span * (k - i) / count
                lines[k]["end"] = left + span * (k - i + 1) / count
            i = j + 1

    # Una frase dura hasta que arranca la siguiente: evita huecos en blanco por
    # palabras que Whisper no reconoció dentro de una frase cantada.
    for i in range(len(lines) - 1):
        current, following = lines[i], lines[i + 1]
        if current["end"] is None or current["start"] is None or following["start"] is None:
            continue
        if following["start"] > current["start"]:
            current["end"] = min(current["end"], following["start"])

    # Monotonía y límites: sin solapamientos y dentro de la duración real.
    previous_end = 0.0
    for line in lines:
        start = max(previous_end, float(line["start"] or 0.0))
        end = max(start + 0.2, float(line["end"] or start + 0.2))
        if audio_end:
            end = min(end, audio_end)
            start = min(start, end)
        line["start"] = round(start, 2)
        line["end"] = round(end, 2)
        previous_end = line["end"]

    overall = weighted_confidence / total_weight if total_weight else 0.0
    for line in lines:
        line["time"] = line["start"]
    return lines, round(overall, 3)


# --- Whisper ----------------------------------------------------------------


def transcribe(audio_path: Path, model, options) -> tuple[list[AudioWord], float]:
    # VAD desactivado por defecto: está entrenado para habla y suele descartar el
    # canto con acompañamiento. Se puede forzar con --vad.
    segments, info = model.transcribe(
        str(audio_path),
        language=options.language,
        word_timestamps=True,
        vad_filter=options.vad,
        beam_size=5,
        condition_on_previous_text=False,
        no_speech_threshold=0.6,
        log_prob_threshold=-1.0,
    )
    words: list[AudioWord] = []
    for segment in segments:
        for word in segment.words or []:
            # Whisper puede devolver palabras sin tiempos; se descartan.
            if word.start is None or word.end is None or not word.word:
                continue
            norm = normalize_word(word.word)
            if not norm:
                continue
            words.append(
                AudioWord(
                    start=word.start,
                    end=word.end,
                    seg_end=segment.end if segment.end is not None else word.end,
                    text=word.word.strip(),
                    norm=norm,
                )
            )
    duration = float(getattr(info, "duration", 0.0) or 0.0)
    return words, duration


# --- Respaldo aproximado (mismo criterio que la web, solo si falla la voz) ---


def phrase_weight(text: str) -> float:
    groups = len(re.findall(r"[aeiouáéíóúü]+", text.lower()))
    return max(1, groups) + (1.5 if re.search(r"[.;?!][\"”']?$", text) else 0.5)


def analyze_envelope(audio_path: Path) -> tuple[list[float], float, float]:
    """Envolvente de energía (RMS por 0.1 s) decodificando el audio con ffmpeg."""
    import numpy as np

    sample_rate = 8000
    step = 0.1
    size = int(sample_rate * step)
    process = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(audio_path), "-ac", "1", "-ar", str(sample_rate), "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    )
    samples = np.frombuffer(process.stdout, dtype="<f4")
    duration = len(samples) / sample_rate if len(samples) else 0.0
    bins = max(1, math.ceil(len(samples) / size))
    energy: list[float] = []
    for b in range(bins):
        chunk = samples[b * size:(b + 1) * size]
        energy.append(float(np.sqrt(float(np.mean(chunk * chunk)))) if chunk.size else 0.0)
    return energy, step, duration


def estimate_timeline(fragments: list[dict], energy: list[float], step: float, duration: float) -> list[dict]:
    if not fragments or not energy or not (duration > 0):
        return []
    peak = max(energy)
    if not peak:
        return []
    threshold = peak * 0.035
    first = next((i for i, value in enumerate(energy) if value > threshold), None)
    if first is None:
        return []
    last = len(energy) - 1
    while last > first and energy[last] <= threshold:
        last -= 1
    start = first * step
    finish = min(duration, (last + 1) * step)
    weights = [phrase_weight(fragment["text"]) for fragment in fragments]
    total = sum(weights) or 1.0
    boundaries = [start]
    accumulated = 0.0
    for i in range(1, len(fragments)):
        accumulated += weights[i - 1]
        target = start + (finish - start) * accumulated / total
        span = (finish - start) * min(weights[i - 1], weights[i]) / total
        radius = min(1.5, span * 0.3)
        best, best_score = target, float("inf")
        for b in range(math.ceil((target - radius) / step), math.floor((target + radius) / step) + 1):
            moment = b * step
            if b < 0 or b >= len(energy) or moment <= boundaries[i - 1]:
                continue
            score = energy[b] / peak + 0.35 * abs(moment - target) / (radius or 1)
            if score < best_score:
                best_score, best = score, moment
        boundaries.append(best)
    boundaries.append(finish)
    lines = []
    for i, fragment in enumerate(fragments):
        entry = dict(fragment)
        entry["start"] = round(boundaries[i], 2)
        entry["end"] = round(max(boundaries[i + 1], boundaries[i] + 0.2), 2)
        entry["time"] = entry["start"]
        entry["confidence"] = ESTIMATED_CONFIDENCE
        lines.append(entry)
    return lines


# --- Proceso por himno ------------------------------------------------------


def resolve_txt(hymn: dict) -> Path | None:
    route = hymn.get("txtRoute") or ""
    candidate = LETRAS_DIR / Path(route).name
    return candidate if candidate.exists() else None


def resolve_audio(hymn: dict) -> Path | None:
    for key in ("mp3Route", "mp3RouteInstr"):
        route = hymn.get(key)
        if not route:
            continue
        for folder in ("cantadas", "instrumentales"):
            candidate = ROOT / "data" / "audios" / folder / Path(route).name
            if candidate.exists():
                return candidate
    return None


def output_path(hymn: dict) -> Path | None:
    txt_path = resolve_txt(hymn)
    return SYNC_DIR / f"{txt_path.stem}.sync.json" if txt_path else None


def is_valid_sync(path: Path) -> bool:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return (
        isinstance(data, dict)
        and data.get("syncMethod") in ("vocal-alignment", "estimated")
        and isinstance(data.get("lines"), list)
        and len(data["lines"]) > 0
    )


def build_vocal(hymn: dict, fragments: list[dict], audio_path: Path, model, options) -> dict:
    words, duration = transcribe(audio_path, model, options)
    if not words:
        return {}
    lines, confidence = build_timeline(fragments, words, duration)
    if not lines:
        return {}
    return {
        "syncMethod": "vocal-alignment",
        "confidence": confidence,
        "language": options.language,
        "model": options.model,
        "hymn": hymn.get("number"),
        "source": audio_path.name,
        "duration": round(duration, 2),
        "needsReview": confidence < options.review_threshold,
        "lines": lines,
    }


def build_estimated(hymn: dict, fragments: list[dict], audio_path: Path) -> dict:
    energy, step, duration = analyze_envelope(audio_path)
    lines = estimate_timeline(fragments, energy, step, duration)
    if not lines:
        return {}
    return {
        "syncMethod": "estimated",
        "confidence": ESTIMATED_CONFIDENCE,
        "hymn": hymn.get("number"),
        "source": audio_path.name,
        "duration": round(duration, 2),
        "needsReview": True,
        "fallbackReason": "La alineación vocal no fue fiable; se usó el reparto aproximado.",
        "lines": lines,
    }


def run_hymn(hymn: dict, model, options) -> dict:
    """Procesa un himno y devuelve un resultado serializable."""
    number = hymn.get("number")
    result = {"number": number, "title": hymn.get("title"), "status": "error", "message": "", "confidence": None, "needsReview": False, "method": None, "lines": 0, "output": None}

    txt_path = resolve_txt(hymn)
    audio_path = resolve_audio(hymn)
    if not txt_path:
        result["message"] = "archivo TXT no encontrado"
        return result
    if not audio_path:
        result["message"] = "archivo MP3 no encontrado"
        return result

    output = output_path(hymn)
    try:
        fragments = expand_hymn(parse_hymn(txt_path.read_text(encoding="utf-8", errors="replace")))
        if not fragments:
            result["message"] = "el TXT no produjo fragmentos"
            return result

        data = build_vocal(hymn, fragments, audio_path, model, options)
        if not data or data["confidence"] < options.min_confidence:
            data = build_estimated(hymn, fragments, audio_path)
            if not data:
                result["message"] = "sin voz reconocible ni envolvente de audio"
                return result
    except SystemExit as error:
        result["message"] = str(error)
        return result
    except Exception as error:  # un himno no debe tumbar el lote
        result["message"] = f"{type(error).__name__}: {error}"
        return result

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    result.update(
        status="review" if data.get("needsReview") else "ok",
        method=data["syncMethod"],
        confidence=data["confidence"],
        needsReview=bool(data.get("needsReview")),
        lines=len(data["lines"]),
        output=output.name,
    )
    return result


def _init_worker(model_name: str, device: str, compute_type: str, threads: int, language: str, vad: bool, review_threshold: float, min_confidence: float) -> None:
    from faster_whisper import WhisperModel

    _WORKER["model"] = WhisperModel(model_name, device=device, compute_type=compute_type, cpu_threads=threads)
    _WORKER["options"] = SimpleNamespace(
        language=language,
        vad=vad,
        model=model_name,
        review_threshold=review_threshold,
        min_confidence=min_confidence,
    )


def _worker_run(hymn: dict) -> dict:
    return run_hymn(hymn, _WORKER["model"], _WORKER["options"])


_WORKER: dict = {}


def find_hymns(tokens: list[str], catalog: list[dict]) -> list[dict]:
    selected = []
    for token in tokens:
        raw = str(token).strip()
        normalized = str(int(raw)) if raw.isdigit() else raw
        found = next(
            (h for h in catalog if str(h.get("number")) == normalized or str(h.get("id")) == normalized),
            None,
        )
        if not found:
            print(f"  ! himno {token} no encontrado en el catálogo", file=sys.stderr)
            continue
        selected.append(found)
    return selected


def select_hymns(catalog: list[dict], tokens: list[str], process_all: bool) -> list[dict]:
    if process_all:
        return list(catalog)
    if tokens:
        return find_hymns(tokens, catalog)
    return []


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sincronización vocal (Whisper) del himnario")
    parser.add_argument("hymns", nargs="*", help="números o ids de himno (posicional, compatibilidad)")
    parser.add_argument("--id", dest="ids", nargs="+", default=[], help="número(s) o id(s) concretos, p. ej. --id 25")
    parser.add_argument("--all", action="store_true", help="procesa todo el catálogo")
    parser.add_argument("--model", default="medium", help="modelo Whisper (tiny/base/small/medium/large-v3)")
    parser.add_argument("--language", default="es", help="idioma del canto")
    parser.add_argument("--device", default="cpu", help="cpu o cuda")
    parser.add_argument("--compute-type", default="int8", help="int8, int8_float16, float16, float32")
    parser.add_argument("--vad", action="store_true", help="filtro VAD (desactivado: descarta el canto)")
    parser.add_argument("--force", action="store_true", help="reprocesa aunque exista un .sync.json válido")
    parser.add_argument("--min-confidence", type=float, default=0.25, help="por debajo de esto se usa el respaldo aproximado")
    parser.add_argument("--review-threshold", type=float, default=REVIEW_THRESHOLD, help="por debajo de esto se marca needsReview")
    parser.add_argument("--workers", type=int, default=1, help="procesos en paralelo (cada uno carga el modelo una vez)")
    parser.add_argument("--report", default=str(DEFAULT_REPORT), help="ruta del informe JSON")
    parser.add_argument("--no-report", action="store_true", help="no escribir el informe")
    options = parser.parse_args(argv)

    tokens = list(options.ids) + list(options.hymns)
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    hymns = select_hymns(catalog, tokens, options.all)
    if not hymns:
        parser.error("indica himnos (--id 25 / posicional) o usa --all")
        return 2

    print("=" * 48)
    print("Sincronización de himnos")
    print("=" * 48)

    pending: list[dict] = []
    results: list[dict] = []
    for hymn in hymns:
        number = hymn.get("number")
        txt_path = resolve_txt(hymn)
        audio_path = resolve_audio(hymn)
        output = output_path(hymn)
        if not txt_path:
            results.append({"number": number, "title": hymn.get("title"), "status": "error", "message": "archivo TXT no encontrado", "needsReview": False, "method": None, "confidence": None, "lines": 0, "output": None})
            print(f"[ERROR] {number:>3} - archivo TXT no encontrado")
        elif not audio_path:
            results.append({"number": number, "title": hymn.get("title"), "status": "error", "message": "archivo MP3 no encontrado", "needsReview": False, "method": None, "confidence": None, "lines": 0, "output": None})
            print(f"[ERROR] {number:>3} - archivo MP3 no encontrado")
        elif output and output.exists() and not options.force and is_valid_sync(output):
            results.append({"number": number, "title": hymn.get("title"), "status": "skipped", "message": "ya sincronizado", "needsReview": False, "method": None, "confidence": None, "lines": 0, "output": output.name})
            print(f"[SKIP]  {number:>3} - ya sincronizado")
        else:
            pending.append(hymn)

    def report_result(result: dict) -> None:
        number = result["number"]
        if result["status"] == "ok":
            print(f"[OK]    {number:>3} - confidence: {result['confidence']:.2f}")
        elif result["status"] == "review":
            print(f"[WARN]  {number:>3} - confidence: {result['confidence']:.2f} - necesita revisión")
        elif result["status"] == "error":
            print(f"[ERROR] {number:>3} - {result['message']}")

    def flush_report() -> dict:
        ordered = sorted(results, key=lambda item: int(item["number"]) if str(item["number"]).isdigit() else 0)
        summary = {
            "total": len(hymns),
            "vocalAligned": sum(1 for r in results if r["method"] == "vocal-alignment"),
            "estimated": sum(1 for r in results if r["method"] == "estimated"),
            "needsReview": sum(1 for r in results if r["needsReview"] and r["status"] == "review"),
            "errors": sum(1 for r in results if r["status"] == "error"),
            "skipped": sum(1 for r in results if r["status"] == "skipped"),
            "needsReviewIds": sorted(int(r["number"]) for r in results if r["needsReview"]),
            "estimatedIds": sorted(int(r["number"]) for r in results if r["method"] == "estimated"),
            "errorIds": sorted(int(r["number"]) for r in results if r["status"] == "error"),
        }
        if not options.no_report:
            Path(options.report).write_text(
                json.dumps(dict(summary, results=ordered), ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        return summary

    threads = max(1, (os.cpu_count() or 1) // max(1, options.workers))
    if pending and options.workers > 1:
        with ProcessPoolExecutor(
            max_workers=options.workers,
            initializer=_init_worker,
            initargs=(options.model, options.device, options.compute_type, threads, options.language, options.vad, options.review_threshold, options.min_confidence),
        ) as pool:
            futures = {pool.submit(_worker_run, hymn): hymn for hymn in pending}
            for future in as_completed(futures):
                result = future.result()
                results.append(result)
                report_result(result)
                flush_report()
    elif pending:
        from faster_whisper import WhisperModel

        print(f"Cargando modelo Whisper '{options.model}' ({options.device}/{options.compute_type})…")
        model = WhisperModel(options.model, device=options.device, compute_type=options.compute_type)
        for hymn in pending:
            result = run_hymn(hymn, model, options)
            results.append(result)
            report_result(result)
            flush_report()

    summary = flush_report()

    print()
    print(f"Procesados: {len(pending)}")
    print(f"Correctos: {summary['vocalAligned']}")
    print(f"Aproximados: {summary['estimated']}")
    print(f"Advertencias (revisar): {summary['needsReview']}")
    print(f"Errores: {summary['errors']}")
    print(f"Omitidos: {summary['skipped']}")
    if summary["needsReviewIds"]:
        print(f"IDs por revisar: {summary['needsReviewIds']}")
    if summary["errorIds"]:
        print(f"IDs con error: {summary['errorIds']}")
    if not options.no_report:
        print(f"Informe: {options.report}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

