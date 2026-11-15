/** Keyless info APIs. fetchFn is injectable for tests. */
async function j(fetchFn, url, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetchFn(url, { signal: c.signal, headers: { 'User-Agent': 'Claudo-MD/1.0' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
const enc = encodeURIComponent;

const WMO = { 0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail' };
const wmo = (c) => WMO[c] || 'Unknown';

async function weather(place, fetchFn = fetch) {
  const g = await j(fetchFn, `https://geocoding-api.open-meteo.com/v1/search?name=${enc(place)}&count=1&language=en`);
  const p = g.results && g.results[0];
  if (!p) throw new Error('place not found');
  const w = await j(fetchFn, `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`);
  const c = w.current, d = w.daily;
  return {
    place: [p.name, p.admin1, p.country].filter(Boolean).join(', '),
    now: { temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m, wind: c.wind_speed_10m, text: wmo(c.weather_code) },
    days: d.time.map((t, i) => ({ date: t, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], text: wmo(d.weather_code[i]) })),
  };
}

async function translate(text, to = 'en', from = 'auto', fetchFn = fetch) {
  const r = await j(fetchFn, `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${enc(from)}&tl=${enc(to)}&dt=t&q=${enc(text)}`);
  const out = (r[0] || []).map((s) => s[0]).join('');
  if (!out) throw new Error('no translation');
  return { text: out, from: r[2] || from };
}

async function wiki(q, fetchFn = fetch) {
  const s = await j(fetchFn, `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${enc(q)}&limit=1`);
  const key = s.pages && s.pages[0] && s.pages[0].key;
  if (!key) throw new Error('nothing found');
  const d = await j(fetchFn, `https://en.wikipedia.org/api/rest_v1/page/summary/${enc(key)}`);
  return { title: d.title, extract: d.extract || '', url: d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page, image: d.thumbnail && d.thumbnail.source };
}

async function define(word, fetchFn = fetch) {
  const r = await j(fetchFn, `https://api.dictionaryapi.dev/api/v2/entries/en/${enc(word)}`);
  const e = Array.isArray(r) && r[0];
  if (!e) throw new Error('no definition');
  const meanings = (e.meanings || []).slice(0, 3).map((m) => ({ pos: m.partOfSpeech, def: m.definitions && m.definitions[0] && m.definitions[0].definition, ex: m.definitions && m.definitions[0] && m.definitions[0].example }));
  return { word: e.word, phonetic: e.phonetic || '', meanings };
}

async function convert(amount, from, to, fetchFn = fetch) {
  const f = from.toUpperCase(), t = to.toUpperCase();
  const r = await j(fetchFn, `https://open.er-api.com/v6/latest/${enc(f)}`);
  if (r.result !== 'success' || !r.rates || r.rates[t] == null) throw new Error('unknown currency');
  return { rate: r.rates[t], value: amount * r.rates[t], from: f, to: t };
}

module.exports = { weather, translate, wiki, define, convert, wmo };
