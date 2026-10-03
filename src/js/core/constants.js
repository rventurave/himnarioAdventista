export const MODES = {
  LYRICS: "lyrics",
  SUNG: "sung",
  KARAOKE: "karaoke",
};

export const DEFAULT_MODE = MODES.SUNG;

export const SEEK_STEP = 5;

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
