export const MODES = {
  LYRICS: "lyrics",
  SUNG: "sung",
  KARAOKE: "karaoke",
};

export const DEFAULT_MODE = MODES.SUNG;

export const SEEK_STEP = 5;

// Ambos modos muestran la frase un segundo antes de su tiempo cantado.
export const LYRICS_LEAD_SECONDS = 1;

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
