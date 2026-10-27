export const MODES = {
  LYRICS: "lyrics",
  SUNG: "sung",
  KARAOKE: "karaoke",
};

export const DEFAULT_MODE = MODES.SUNG;

export const SEEK_STEP = 5;

// En Solo letra el reloj es virtual: las flechas avanzan o retroceden un segundo.
export const LYRICS_SEEK_STEP = 1;

// Ambos modos muestran la frase un segundo antes de su tiempo cantado.
export const LYRICS_LEAD_SECONDS = 1;

// Portada inicial mínima cuando la primera frase empieza sin introducción.
export const INTRO_SECONDS = 5;

export const HOME_PATH = "/";

export const HYMN_REQUIRED_FIELDS = [
  "id",
  "number",
  "title",
  "mp3Route",
  "mp3RouteInstr",
  "mp3Filename",
  "bibleReference",
  "txtRoute",
];
