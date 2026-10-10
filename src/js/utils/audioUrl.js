// Conserva los nombres del catálogo y codifica cada segmento una sola vez.
export function resolveAudioUrl(reference, folder, baseUrl) {
  if (typeof reference !== "string" || !reference.trim()) return null;
  if (!["cantadas", "instrumentales"].includes(folder)) return null;
  let path = reference.trim();
  if (/^https?:\/\//i.test(path)) {
    try { path = new URL(path).pathname; } catch { return null; }
  } else if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) {
    return null;
  }
  path = path.replace(/^\/+/, "").replace(/^(?:data\/)?audios\//, "");
  const segments = path.split("/");
  if (segments.length === 1) segments.unshift(folder);
  if (segments.length !== 2 || segments[0] !== folder) return null;
  const decoded = segments.map(segment => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
  if (decoded.some(segment => !segment || segment === "." || segment === ".." || /[/\\]/.test(segment))) return null;
  if (!/\.mp3$/i.test(decoded[1])) return null;
  try {
    const base = new URL(baseUrl);
    if (!["https:", "http:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) return null;
    return `${base.href.replace(/\/+$/, "")}/${decoded.map(encodeURIComponent).join("/")}`;
  } catch { return null; }
}
