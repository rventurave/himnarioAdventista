const origin = 'https://himnario-adventista.pages.dev';

export function updateSeo(hymn = null) {
  const title = hymn
    ? `Himno ${hymn.number}: ${hymn.title} | Himnario Adventista`
    : 'Himnario Adventista del Séptimo Día | 613 Himnos';
  const description = hymn
    ? `Himno ${hymn.number}: ${hymn.title}. Consulta su letra en el Himnario Adventista y utiliza los modos cantado, instrumental y karaoke.`
    : 'Himnario Adventista del Séptimo Día con 613 himnos. Consulta las letras, escucha audios cantados e instrumentales y utiliza el modo karaoke.';
  const url = `${origin}/${hymn ? hymn.number : ''}`;
  document.title = title;
  document.querySelector('link[rel="canonical"]').href = url;
  for (const [selector, value] of [
    ['meta[name="description"]', description],
    ['meta[property="og:title"]', title],
    ['meta[property="og:description"]', description],
    ['meta[property="og:url"]', url],
  ]) document.querySelector(selector).content = value;
}
